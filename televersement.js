// televersement.js — envoi du programme Python dans le CyberPi du mBot2, par le cable USB (Web Serial : Chrome, Edge).
//
// Makeblock ne publie pas ce protocole. Il est repris de deux retro-ingenieries independantes et concordantes de
// l'envoi de mBlock 5 (mode « televersement ») :
//   - github.com/weare2plus3/cyberpi-uploader (src/protocol.ts, src/board.ts) ;
//   - github.com/dachrisch/mbot2-course-setup (scripts/mbot_upload.py, docs/06-usb-upload-protocol.md).
// Trame : F3 | entete | longueur (2 octets, petit-boutiste) | corps | somme du corps (1 octet) | F4,
//         entete = (F3 + longueur basse + longueur haute) & FF.
// Sequence : 2 × [ping, exec « import config », exec « REPL coupe »], entete du fichier /flash/_xx_main.py,
// blocs de 80 octets (le dernier de 4), ping + exec + exec, puis redemarrage (fermer, 300 ms, rouvrir).
// Le CyberPi bascule lui-meme le fichier de transit vers main.py a son redemarrage.
// Les octets recus hors trames sont la sortie print() du programme : ils vont dans la console.

(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const VENDEUR_WCH = 0x1A86;           // puce USB-serie du CyberPi (CH340 / CH9102)
    const DEBIT = 115200;
    const ATTENTE_DEMARRAGE = 3000;       // ms : l'ouverture du port redemarre la carte
    const DELAI_REPONSE = 3000, ESSAIS = 3;
    const CHEMIN = '/flash/_xx_main.py';
    const TAILLE_BLOC = 80;
    const CODE_CONFIG = 'try:\n    import config\nexcept:\n    pass';
    const CODE_REPL = 'try:\n    config.write_config("repl_enable", False)\nexcept:\n    pass';

    const pause = ms => new Promise(r => setTimeout(r, ms));
    const u16 = n => [n & 0xFF, (n >> 8) & 0xFF];
    const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
    const somme = octets => octets.reduce((s, o) => (s + o) & 0xFF, 0);

    // ---------- Trames ----------
    function trame(corps) {
        const [bas, haut] = u16(corps.length);
        return new Uint8Array([0xF3, (0xF3 + bas + haut) & 0xFF, bas, haut, ...corps, somme(corps), 0xF4]);
    }
    const corpsPing = () => [0x0D, 0x00, 0x00];
    function corpsExec(code) {
        const octets = Array.from(new TextEncoder().encode(code));
        return [0x28, 0x04, 0x00, 0x00, ...u16(octets.length), ...octets];
    }
    function xor32(octets) {   // XOR des mots de 32 bits petit-boutistes, dernier mot complete par des zeros
        let x = 0;
        for (let i = 0; i < octets.length; i += 4) x ^= (octets[i] | (octets[i + 1] || 0) << 8 | (octets[i + 2] || 0) << 16 | (octets[i + 3] || 0) << 24);
        return x >>> 0;
    }
    function corpsEntete(fichier) {
        const chemin = Array.from(new TextEncoder().encode(CHEMIN));
        const suite = [0x00, ...u32(fichier.length), ...u32(xor32(fichier)), ...chemin];
        return [0x01, 0x00, 0x5E, 0x01, ...u16(suite.length), ...suite];
    }
    function corpsBloc(decalage, morceau) {
        const suite = [...u32(decalage), ...morceau];
        return [0x01, 0x00, 0x5E, 0x02, ...u16(suite.length), ...suite];
    }
    /** Fichier complete par des sauts de ligne pour que sa taille vaille 4 modulo 80 (forme validee sur le materiel). */
    function preparerFichier(code) {
        const octets = Array.from(new TextEncoder().encode(code));
        const ajout = (4 - octets.length % TAILLE_BLOC + TAILLE_BLOC) % TAILLE_BLOC;
        for (let i = 0; i < ajout; i++) octets.push(0x0A);
        return octets;
    }
    function decouper(fichier) {
        const blocs = [];
        for (let i = 0; i < fichier.length; i += TAILLE_BLOC) blocs.push([i, fichier.slice(i, i + TAILLE_BLOC)]);
        return blocs;
    }
    const contient = (corps, motif) => corps.some((_, i) => motif.every((o, j) => corps[i + j] === o));
    const REPONSES = {
        ping: c => c.length === 3 && c[0] === 0x0D,
        exec: c => contient(c, Array.from(new TextEncoder().encode('"ret"'))) || c.length === 18,
        fichier: c => contient(c, [0x5E, 0xF0]) || c.length === 7,
    };

    // ---------- Liaison serie ----------
    class Liaison {
        constructor(port, surTexte) {
            this.port = port; this.surTexte = surTexte;
            this.tampon = []; this.attentes = new Set(); this.lecture = null; this.lecteur = null;
            this.decodeur = new TextDecoder();
        }
        async ouvrir() {
            await this.port.open({ baudRate: DEBIT });
            this.lecture = this.lire();
        }
        async lire() {
            while (this.port.readable) {
                this.lecteur = this.port.readable.getReader();
                try {
                    for (;;) {
                        const { value, done } = await this.lecteur.read();
                        if (done) return;
                        this.recevoir(value);
                    }
                } catch (e) { return; /* port debranche ou ferme */ }
                finally { try { this.lecteur.releaseLock(); } catch (e) { /* deja libere */ } }
            }
        }
        recevoir(octets) {
            this.tampon.push(...octets);
            let texte = [];
            while (this.tampon.length) {
                if (this.tampon[0] !== 0xF3) { texte.push(this.tampon.shift()); continue; }
                if (this.tampon.length < 4) break;
                const [, entete, bas, haut] = this.tampon, longueur = bas | haut << 8;
                if (entete !== ((0xF3 + bas + haut) & 0xFF)) { texte.push(this.tampon.shift()); continue; }
                if (this.tampon.length < longueur + 6) break;
                const corps = this.tampon.slice(4, 4 + longueur);
                if (this.tampon[4 + longueur] !== somme(corps) || this.tampon[5 + longueur] !== 0xF4) { texte.push(this.tampon.shift()); continue; }
                this.tampon.splice(0, longueur + 6);
                for (const a of Array.from(this.attentes)) if (a.reconnaitre(corps)) a.resoudre(corps);
            }
            if (texte.length && this.surTexte) this.surTexte(this.decodeur.decode(new Uint8Array(texte), { stream: true }));
        }
        async ecrire(octets) {
            const ecrivain = this.port.writable.getWriter();
            try { await ecrivain.write(octets); } finally { ecrivain.releaseLock(); }
        }
        /** Envoie une trame et attend la reponse reconnue (3 essais de 3 s). */
        async echanger(corps, reconnaitre) {
            for (let essai = 1; essai <= ESSAIS; essai++) {
                let attente;
                const reponse = new Promise(resoudre => { attente = { reconnaitre, resoudre }; this.attentes.add(attente); });
                await this.ecrire(trame(corps));
                const ok = await Promise.race([reponse.then(() => true), pause(DELAI_REPONSE).then(() => false)]);
                this.attentes.delete(attente);
                if (ok) return;
            }
            throw new Error('le robot ne répond pas');
        }
        async fermer() {
            try { if (this.lecteur) await this.lecteur.cancel(); } catch (e) { /* deja ferme */ }
            try { await this.lecture; } catch (e) { /* rien */ }
            try { await this.port.close(); } catch (e) { /* deja ferme */ }
        }
    }

    // ---------- Interface ----------
    const fenetre = $('fenetre-envoi'), etat = $('envoi-etat'), barre = $('envoi-barre').firstElementChild, go = $('envoi-go');
    let liaison = null, occupe = false;
    const console_ = (t, c) => window.consoleAjouterLigne && window.consoleAjouterLigne(t, c);
    let ligneRobot = '';
    function texteRobot(t) {   // sortie print() du programme : affichee ligne par ligne
        ligneRobot += t;
        const lignes = ligneRobot.split(/\r?\n/);
        ligneRobot = lignes.pop();
        for (const l of lignes) console_('[robot] ' + l, 'robot');
    }
    function majVoyant() {
        const v = $('voyant-robot');
        v.classList.toggle('connecte', !!liaison);
        v.title = liaison ? 'Robot connecté (console)' : 'Robot non connecté';
        $('btn-console-robot').textContent = liaison ? 'Déconnecter le robot' : 'Écouter le robot';
    }
    function afficherEtat(t, classe) { etat.textContent = t; etat.className = classe || ''; }
    async function deconnecter() {
        if (liaison) { const l = liaison; liaison = null; await l.fermer(); console_('Robot déconnecté.', 'info'); }
        majVoyant();
    }
    async function choisirPort(tous) {
        if (!('serial' in navigator)) throw new Error('ce navigateur ne sait pas utiliser le port USB : ouvrez l\'éditeur dans Chrome ou Edge');
        return navigator.serial.requestPort(tous ? {} : { filters: [{ usbVendorId: VENDEUR_WCH }] });
    }

    async function televerser(code) {
        if (occupe) return;
        occupe = true; go.disabled = true;
        barre.style.width = '0';
        try {
            await deconnecter();
            afficherEtat('Choix du robot…');
            const port = await choisirPort($('envoi-tous-ports').checked);
            liaison = new Liaison(port, texteRobot);
            afficherEtat('Connexion au robot…');
            await liaison.ouvrir();
            majVoyant();
            await pause(ATTENTE_DEMARRAGE);

            const fichier = preparerFichier(code), blocs = decouper(fichier);
            const total = 6 + 1 + blocs.length + 3;
            let fait = 0;
            const etape = async (corps, reconnaitre) => { await liaison.echanger(corps, reconnaitre); barre.style.width = (++fait / total * 100) + '%'; };
            afficherEtat('Préparation du robot…');
            for (let passe = 0; passe < 2; passe++) {
                await etape(corpsPing(), REPONSES.ping);
                await etape(corpsExec(CODE_CONFIG), REPONSES.exec);
                await etape(corpsExec(CODE_REPL), REPONSES.exec);
            }
            afficherEtat('Envoi du programme (' + fichier.length + ' octets)…');
            await etape(corpsEntete(fichier), REPONSES.fichier);
            for (const [decalage, morceau] of blocs) await etape(corpsBloc(decalage, morceau), REPONSES.fichier);
            await etape(corpsPing(), REPONSES.ping);
            await etape(corpsExec(CODE_CONFIG), REPONSES.exec);
            await etape(corpsExec(CODE_REPL), REPONSES.exec);

            afficherEtat('Redémarrage du robot…');
            await liaison.fermer();
            await pause(300);
            await liaison.ouvrir();   // la reouverture du port redemarre le CyberPi, qui lance le nouveau programme
            afficherEtat('Programme envoyé : le robot a redémarré avec votre programme.', 'ok');
            console_('Programme envoyé au mBot2 (' + fichier.length + ' octets). Console du robot ouverte.', 'ok');
        } catch (e) {
            const message = e && e.name === 'NotFoundError' ? 'Aucun robot choisi.' : 'Échec de l\'envoi : ' + (e && e.message ? e.message : e) + '.';
            afficherEtat(message, 'err');
            if (!(e && e.name === 'NotFoundError')) {
                console_(message + ' Vérifiez le câble, que le robot est allumé et que mBlock est fermé.', 'err');
                if (e && e.name === 'NetworkError') console_('Le port est peut-être déjà utilisé par un autre logiciel (mBlock, mLink) ou un autre onglet.', 'err');
            }
            await deconnecter();
        } finally {
            occupe = false; go.disabled = false; majVoyant();
        }
    }

    async function ecouter() {
        if (liaison) { await deconnecter(); return; }
        try {
            const port = await choisirPort($('envoi-tous-ports').checked);
            liaison = new Liaison(port, texteRobot);
            await liaison.ouvrir();
            console_('Robot connecté : le programme redémarre, ce qu\'il écrit avec « écrire … dans la console de l\'ordinateur » s\'affiche ici.', 'ok');
        } catch (e) {
            liaison = null;
            if (!(e && e.name === 'NotFoundError')) console_('Connexion impossible : ' + (e && e.message ? e.message : e), 'err');
        }
        majVoyant();
    }

    $('btn-envoyer').addEventListener('click', () => {
        afficherEtat(''); barre.style.width = '0';
        fenetre.classList.add('ouvert');
        go.focus();
    });
    $('envoi-fermer').addEventListener('click', () => fenetre.classList.remove('ouvert'));
    fenetre.addEventListener('keydown', e => { if (e.key === 'Escape' && !occupe) fenetre.classList.remove('ouvert'); });
    go.addEventListener('click', () => televerser(window.codePythonCourant ? window.codePythonCourant() : ''));
    $('btn-console-robot').addEventListener('click', ecouter);
    if ('serial' in navigator) navigator.serial.addEventListener('disconnect', e => { if (liaison && e.target === liaison.port) deconnecter(); });
    majVoyant();

    // Pour les tests (console du navigateur) : construction des trames sans robot.
    window.TeleversementTest = { trame, corpsPing, corpsExec, corpsEntete, corpsBloc, preparerFichier, decouper, xor32, REPONSES, Liaison };
})();
