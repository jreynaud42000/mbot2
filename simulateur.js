// simulateur.js — mBot2 simule en 2D, vue de dessus, sur une piste a l'echelle (unites : cm, s, degres).
//
// Le programme des blocs est traduit en JavaScript asynchrone par blocs.js (generateur « SIMU ») ; il appelle
// l'objet R cree ici a chaque lancement. Le robot avance selon la vitesse de ses deux roues (entrainement
// differentiel) ; les capteurs lisent la piste : ultrasons par lancer de rayons sur les obstacles et les murs,
// quad RGB par lecture de la couleur du sol sous chacun des 4 capteurs.
//
// Dimensions : mBot2 ≈ 18 × 13 cm (fiches revendeurs), moteurs 200 tr/min max, ultrasons 3 a 300 cm (Makeblock).
// Diametre des roues et entraxe NON documentes : valeurs estimees, a mesurer sur un vrai robot (ROUE_D, ENTRAXE).

(function () {
    'use strict';
    const $ = id => document.getElementById(id);

    // ---------- Geometrie du robot (cm ; f = vers l'avant depuis l'axe des roues, l = vers la droite) ----------
    const ROUE_D = 6.5;             // diametre des roues (estime)
    const ENTRAXE = 11.5;           // distance entre les deux roues (estimee)
    const CORPS = { arriere: -7, avant: 11, demiLargeur: 6.5 };
    const ULTRASONS_F = 10.5;
    const QUAD_F = 7.5;
    const QUAD_L = { L2: -2.7, L1: -0.9, R1: 0.9, R2: 2.7 };
    const RPM_MAX = 200;
    const TAU_MOTEUR = 0.08;        // temps de reponse des moteurs (s)

    // ---------- Pistes (200 × 150 cm, dessinees a 4 px/cm) ----------
    const LARGEUR = 200, HAUTEUR = 150, ECH = 4;
    function courbeFermee(ctx, pts) {   // Catmull-Rom fermee passant par tous les points
        const n = pts.length;
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
            ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
                              p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
        }
    }
    function quadrillage(ctx) {
        ctx.strokeStyle = '#ececec'; ctx.lineWidth = 0.15;
        for (let x = 10; x < LARGEUR; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HAUTEUR); ctx.stroke(); }
        for (let y = 10; y < HAUTEUR; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LARGEUR, y); ctx.stroke(); }
    }
    const SINUEUX = [[40, 28], [100, 48], [160, 28], [180, 75], [160, 122], [120, 100], [80, 126], [28, 112], [22, 70]];
    const PISTES = {
        libre: { nom: 'Sol libre', depart: [40, 75, 0], obstacles: [], dessin: quadrillage },
        ovale: {
            nom: 'Ovale (suivi de ligne)', depart: [92, 120, 0], obstacles: [],
            dessin(ctx) {
                quadrillage(ctx);
                ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(55, 75, 45, Math.PI / 2, 3 * Math.PI / 2); ctx.lineTo(145, 30);
                ctx.arc(145, 75, 45, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.stroke();
            },
        },
        sinueux: {
            nom: 'Circuit sinueux (suivi de ligne)', obstacles: [],
            depart: (() => {   // sur la ligne, capteurs au-dessus du trait, dans le sens du parcours
                const [p0, p1, pn] = [SINUEUX[0], SINUEUX[1], SINUEUX[SINUEUX.length - 1]];
                const a = Math.atan2(p1[1] - pn[1], p1[0] - pn[0]);
                return [p0[0] - Math.cos(a) * QUAD_F, p0[1] - Math.sin(a) * QUAD_F, a * 180 / Math.PI];
            })(),
            dessin(ctx) {
                quadrillage(ctx);
                ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
                ctx.beginPath(); courbeFermee(ctx, SINUEUX); ctx.closePath(); ctx.stroke();
            },
        },
        obstacles: {
            nom: 'Arène à obstacles', depart: [22, 75, 0],
            obstacles: [{ x: 70, y: 62, w: 20, h: 26 }, { x: 120, y: 18, w: 18, h: 30 }, { x: 125, y: 100, w: 30, h: 18 }, { x: 165, y: 60, w: 16, h: 16 }],
            dessin: quadrillage,
        },
        couleurs: {
            nom: 'Zones de couleur', depart: [20, 75, 0], obstacles: [],
            dessin(ctx) {
                quadrillage(ctx);
                const zones = [['#e03131', 45], ['#fcc419', 80], ['#2f9e44', 115], ['#1971c2', 150]];
                for (const [c, x] of zones) { ctx.fillStyle = c; ctx.fillRect(x, 60, 25, 30); }
                ctx.fillStyle = '#111'; ctx.fillRect(183, 20, 4, 110);
            },
        },
    };

    // ---------- Etat ----------
    const horloge = { t: 0, attentes: [] };   // temps de simulation (s) et attentes du programme
    const robot = { x: 40, y: 75, a: 0, cibleG: 0, cibleD: 0, rpmG: 0, rpmD: 0, angleG: 0, angleD: 0, cap0: 0 };
    let piste = 'ovale', obstacles = [], sol = null;   // sol : pixels de la piste (lecture des capteurs)
    const fond = document.createElement('canvas');
    fond.width = LARGEUR * ECH; fond.height = HAUTEUR * ECH;
    fond.getContext('2d', { willReadFrequently: true });   // la piste est relue (getImageData) a chaque changement
    const canevas = $('piste'), ctx = canevas.getContext('2d');

    function chargerPiste(cle) {
        piste = PISTES[cle] ? cle : 'ovale';
        const p = PISTES[piste], c = fond.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, fond.width, fond.height);
        c.setTransform(ECH, 0, 0, ECH, 0, 0);
        p.dessin(c);
        sol = c.getImageData(0, 0, fond.width, fond.height).data;
        obstacles = p.obstacles.map(o => Object.assign({}, o));
        replacer();
        try { localStorage.setItem('mbot2_piste', piste); } catch (e) { /* navigation privee */ }
    }
    function replacer() {
        const [x, y, a] = PISTES[piste].depart;
        Object.assign(robot, { x, y, a: a * Math.PI / 180, cibleG: 0, cibleD: 0, rpmG: 0, rpmD: 0 });
    }

    // ---------- Capteurs ----------
    const avant = (f, l) => [robot.x + Math.cos(robot.a) * f - Math.sin(robot.a) * l, robot.y + Math.sin(robot.a) * f + Math.cos(robot.a) * l];
    function couleurSolEn(x, y) {   // moyenne 3 × 3 pixels (0 a 255)
        let r = 0, g = 0, b = 0, n = 0;
        const cx = Math.round(x * ECH), cy = Math.round(y * ECH);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const px = cx + dx, py = cy + dy;
            if (px < 0 || py < 0 || px >= fond.width || py >= fond.height) { n++; continue; }   // hors piste : noir
            const i = (py * fond.width + px) * 4;
            r += sol[i]; g += sol[i + 1]; b += sol[i + 2]; n++;
        }
        return [r / n, g / n, b / n];
    }
    const luminance = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    function gris(capteur) {   // lumiere reflechie : ~95 sur blanc, ~5 sur noir
        const [x, y] = avant(QUAD_F, QUAD_L[capteur] || 0);
        return Math.round(5 + 90 * luminance(couleurSolEn(x, y)));
    }
    const voitLigne = capteur => gris(capteur) < 50;
    function nomCouleur(rgb) {
        const [r, g, b] = rgb.map(c => c / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), s = max ? (max - min) / max : 0;
        if (s < 0.3) return max > 0.55 ? 'white' : 'black';
        let h;
        if (max === r) h = ((g - b) / (max - min) + 6) % 6; else if (max === g) h = (b - r) / (max - min) + 2; else h = (r - g) / (max - min) + 4;
        h *= 60;
        if (h < 25 || h >= 330) return 'red';
        if (h < 70) return 'yellow';
        if (h < 160) return 'green';
        if (h < 200) return 'cyan';
        if (h < 260) return 'blue';
        return 'purple';
    }
    function ecartLigne() {
        // Barycentre de la ligne sous la barre de capteurs (± 4 cm). Convention de la documentation Makeblock :
        // -100 = capteur a gauche de la ligne (ligne a droite). A verifier sur le vrai robot.
        let somme = 0, poids = 0;
        for (let l = -4; l <= 4.001; l += 0.5) {
            const [x, y] = avant(QUAD_F, l), noir = 1 - luminance(couleurSolEn(x, y));
            if (noir > 0.5) { somme += l * noir; poids += noir; }
        }
        if (!poids) return 0;
        return Math.round(Math.max(-100, Math.min(100, -(somme / poids) / 3.6 * 100)));
    }
    function rayon(x, y, dx, dy) {   // distance jusqu'au premier obstacle ou mur
        let t = Infinity;
        const tranche = (o) => {
            let tmin = -Infinity, tmax = Infinity;
            for (const [p, d, a, b] of [[x, dx, o.x, o.x + o.w], [y, dy, o.y, o.y + o.h]]) {
                if (Math.abs(d) < 1e-9) { if (p < a || p > b) return; continue; }
                let t1 = (a - p) / d, t2 = (b - p) / d;
                if (t1 > t2) [t1, t2] = [t2, t1];
                tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
            }
            if (tmax >= tmin && tmin > 0) t = Math.min(t, tmin);
        };
        obstacles.forEach(tranche);
        if (dx > 0) t = Math.min(t, (LARGEUR - x) / dx); else if (dx < 0) t = Math.min(t, -x / dx);
        if (dy > 0) t = Math.min(t, (HAUTEUR - y) / dy); else if (dy < 0) t = Math.min(t, -y / dy);
        return t;
    }
    function mesureUltrasons() {
        const [x, y] = avant(ULTRASONS_F, 0);
        let d = Infinity;
        for (const ecart of [-0.12, 0, 0.12]) d = Math.min(d, rayon(x, y, Math.cos(robot.a + ecart), Math.sin(robot.a + ecart)));
        return d > 300 ? 300 : Math.max(3, Math.round(d * 10) / 10);
    }

    // ---------- Mouvement ----------
    function collision() {
        const pts = [];
        for (const f of [CORPS.arriere, 2, CORPS.avant]) for (const l of [-CORPS.demiLargeur, 0, CORPS.demiLargeur]) if (f !== 2 || l !== 0) pts.push(avant(f, l));
        return pts.some(([x, y]) => x < 0 || y < 0 || x > LARGEUR || y > HAUTEUR ||
            obstacles.some(o => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h));
    }
    let bloque = false;
    function avancer(dt) {
        const k = 1 - Math.exp(-dt / TAU_MOTEUR);
        robot.rpmG += (robot.cibleG - robot.rpmG) * k;
        robot.rpmD += (robot.cibleD - robot.rpmD) * k;
        const ancien = { x: robot.x, y: robot.y, a: robot.a };
        const vG = robot.rpmG / 60 * Math.PI * ROUE_D, vD = robot.rpmD / 60 * Math.PI * ROUE_D;   // cm/s
        robot.a += (vG - vD) / ENTRAXE * dt;   // repere ecran (y vers le bas) : roue gauche plus rapide = virage a droite
        robot.x += Math.cos(robot.a) * (vG + vD) / 2 * dt;
        robot.y += Math.sin(robot.a) * (vG + vD) / 2 * dt;
        bloque = collision();
        if (bloque) Object.assign(robot, ancien);   // contre un mur : le robot reste en place, ses roues patinent
        const dG = robot.rpmG / 60 * 360 * dt, dD = robot.rpmD / 60 * 360 * dt;
        robot.angleG += dG;
        robot.angleD += dD;
        // « avancer de … cm » / « tourner de … ° » : arret exact quand les encodeurs ont parcouru l'angle de roue voulu,
        // verifie a chaque petit pas de calcul (le resultat ne depend pas de la fluidite de l'affichage).
        if (robot.but) {
            robot.but.fait += (Math.abs(dG) + Math.abs(dD)) / 2;
            if (robot.but.fait >= robot.but.cible) {
                Object.assign(robot, { cibleG: 0, cibleD: 0, rpmG: 0, rpmD: 0 });
                const fin = robot.but.fin; robot.but = null; fin();
            }
        }
    }
    /** Mouvement mesure par les encodeurs : resolu quand les roues ont tourne de « degresRoue » (moyenne des deux). */
    function mouvementMesure(g, d, degresRoue) {
        if (robot.but) robot.but.fin();
        return new Promise(fin => {
            if (degresRoue <= 0) { fin(); return; }
            robot.but = { fait: 0, cible: degresRoue, fin };
            robot.cibleG = g; robot.cibleD = d;
        });
    }

    // ---------- Dessin ----------
    let voirCapteurs = true;
    const ledsRobot = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    // Robot : photo du vrai mBot2 vu de dessus (images/mbot2_dessus.png, fond transparent, robot tourne vers la gauche).
    // Echelle tiree des roues : 135 px sur la photo pour 6,5 cm ; axe des roues en x = 237 px, milieu en y = 149 px.
    // Sur une photo, les LED ne changent pas de couleur : les LED allumees sont superposees, avec leur halo.
    const PHOTO = { pxParCm: 135 / ROUE_D, axeX: 237, axeY: 149 };
    const photo = new Image();
    photo.src = 'images/mbot2_dessus.png';
    function dessinerRobotPhoto() {
        const s = PHOTO.pxParCm;
        ctx.save();
        ctx.rotate(Math.PI);   // repere de la photo : x vers l'arriere, y vers la gauche du robot
        ctx.drawImage(photo, -PHOTO.axeX / s, -PHOTO.axeY / s, photo.naturalWidth / s, photo.naturalHeight / s);
        ctx.restore();
        ledsRobot.forEach(([r, g, b], i) => {   // 5 LED du CyberPi, de la gauche (LED 1) vers la droite du robot
            if (!(r || g || b)) return;
            const f = -4.5, l = -2.4 + i * 1.2, c = r + ',' + g + ',' + b;   // bord du CyberPi, a cote de l'ecran (x ≈ 330 px)
            const halo = ctx.createRadialGradient(f, l, 0, f, l, 1.1);
            halo.addColorStop(0, 'rgba(' + c + ',0.95)'); halo.addColorStop(1, 'rgba(' + c + ',0)');
            ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(f, l, 1.1, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = 'rgb(' + c + ')'; ctx.beginPath(); ctx.arc(f, l, 0.4, 0, 2 * Math.PI); ctx.fill();
        });
        if (bloque) { ctx.strokeStyle = '#e03131'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.roundRect(CORPS.arriere, -5.5, CORPS.avant - CORPS.arriere, 11, 0.9); ctx.stroke(); }
    }
    /** Dessin de secours (photo pas encore chargee ou introuvable). */
    function dessinerRobotVectoriel() {
        // Repere : f vers l'avant, l vers la droite, en cm. Plaque bleue percee, roues noires en arriere du centre,
        // ultrasons a l'avant, carte d'extension au milieu, batterie grise, CyberPi a l'arriere (ecran et 5 LED).
        const rect = (f0, f1, l0, l1, couleur, rayon) => {
            ctx.fillStyle = couleur; ctx.beginPath(); ctx.roundRect(f0, l0, f1 - f0, l1 - l0, rayon || 0); ctx.fill();
        };
        // roues (pneus a crampons) : de part et d'autre de la plaque
        for (const cote of [-1, 1]) {
            const l0 = cote < 0 ? -CORPS.demiLargeur : CORPS.demiLargeur - 1.7;
            rect(-ROUE_D / 2, ROUE_D / 2, l0, l0 + 1.7, '#141414', 0.6);
            ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 0.18;
            for (let f = -ROUE_D / 2 + 0.6; f < ROUE_D / 2; f += 0.75) { ctx.beginPath(); ctx.moveTo(f, l0 + 0.2); ctx.lineTo(f, l0 + 1.5); ctx.stroke(); }
        }
        // plaque du chassis (bleu clair anodise), trous de fixation
        rect(CORPS.arriere, CORPS.avant - 0.8, -4.8, 4.8, '#2ea7dc', 0.9);
        ctx.fillStyle = '#1b6e94';
        for (let f = CORPS.arriere + 0.8; f < CORPS.avant - 1.2; f += 1.6) for (const l of [-4.2, 4.2]) { ctx.beginPath(); ctx.arc(f, l, 0.22, 0, 2 * Math.PI); ctx.fill(); }
        if (bloque) { ctx.strokeStyle = '#e03131'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.roundRect(CORPS.arriere, -4.8, CORPS.avant - 0.8 - CORPS.arriere, 9.6, 0.9); ctx.stroke(); }
        // carte d'extension mBot2 (circuit sombre, connecteurs blancs, composants)
        rect(2.2, 9.2, -3.9, 3.9, '#2b3035', 0.3);
        ctx.fillStyle = '#e9ecef';
        for (let f = 2.8; f < 8.8; f += 1.2) { ctx.fillRect(f, -3.7, 0.8, 0.6); ctx.fillRect(f, 3.1, 0.8, 0.6); }
        ctx.fillStyle = '#495057';
        for (const [f, l] of [[4.2, -1.2], [4.2, 1.2], [6.4, -1.2], [6.4, 1.2]]) { ctx.beginPath(); ctx.arc(f, l, 0.75, 0, 2 * Math.PI); ctx.fill(); }
        // batterie (cylindre gris)
        rect(-1.8, 2.0, -3.6, 3.6, '#a5abb1', 0.6);
        rect(-1.8, 2.0, -0.6, 0.6, '#c3c8cd');
        // CyberPi : boitier sombre, ecran, 5 LED (1 a gauche, 5 a droite)
        rect(CORPS.arriere + 0.4, -2.0, -3.9, 3.9, '#2d3136', 0.6);
        rect(-5.9, -3.0, -1.6, 1.6, '#16213a', 0.2);
        ledsRobot.forEach(([r, g, b], i) => {
            ctx.fillStyle = (r || g || b) ? 'rgb(' + r + ',' + g + ',' + b + ')' : '#5c636a';
            ctx.beginPath(); ctx.arc(-2.5, -2.6 + i * 1.3, 0.4, 0, 2 * Math.PI); ctx.fill();
        });
        // capteur a ultrasons a l'avant : module sombre et ses deux transducteurs
        rect(CORPS.avant - 1.6, CORPS.avant - 0.2, -4.1, 4.1, '#22262a', 0.3);
        for (const l of [-2.2, 2.2]) rect(CORPS.avant - 0.9, CORPS.avant + 0.5, l - 1.25, l + 1.25, '#c9ced4', 0.4);
    }
    function dessiner() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(fond, 0, 0);
        ctx.setTransform(ECH, 0, 0, ECH, 0, 0);
        ctx.strokeStyle = '#495057'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, LARGEUR - 1, HAUTEUR - 1);
        for (const o of obstacles) {
            ctx.fillStyle = '#b07a46'; ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = '#7a4f26'; ctx.lineWidth = 0.6; ctx.strokeRect(o.x, o.y, o.w, o.h);
            ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h); ctx.stroke();
        }
        if (voirCapteurs) {
            const [x, y] = avant(ULTRASONS_F, 0), d = mesureUltrasons();
            ctx.strokeStyle = 'rgba(28, 126, 214, 0.75)'; ctx.lineWidth = 0.5; ctx.setLineDash([2, 1.5]);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(robot.a) * d, y + Math.sin(robot.a) * d); ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.save();
        ctx.translate(robot.x, robot.y); ctx.rotate(robot.a);
        if (photo.complete && photo.naturalWidth) dessinerRobotPhoto(); else dessinerRobotVectoriel();
        // capteurs de ligne
        for (const [nom, l] of Object.entries(QUAD_L)) {
            ctx.fillStyle = voirCapteurs && voitLigne(nom) ? '#40c057' : '#adb5bd';
            ctx.beginPath(); ctx.arc(QUAD_F, l, 0.55, 0, 2 * Math.PI); ctx.fill();
        }
        ctx.restore();
    }
    function majMesures() {
        $('m-distance').textContent = mesureUltrasons().toLocaleString('fr-FR') + ' cm';
        $('m-ligne').textContent = ['L2', 'L1', 'R1', 'R2'].map(c => voitLigne(c) ? '●' : '○').join(' ');
        $('m-gauche').textContent = Math.round(robot.rpmG) + ' tr/min';
        $('m-droite').textContent = Math.round(robot.rpmD) + ' tr/min';
    }

    // ---------- Ecran du CyberPi (128 × 128) ----------
    const ecranCtx = $('cyberpi-ecran').getContext('2d');
    const ecran = {
        lignes: [{ texte: '', couleur: '#ffffff' }], etiquettes: {}, couleur: '#ffffff',
        reinitialiser() { this.lignes = [{ texte: '', couleur: '#ffffff' }]; this.etiquettes = {}; this.couleur = '#ffffff'; this.dessiner(); },
        ecrire(t) {
            for (const morceau of String(t).split('\n').entries()) {
                if (morceau[0] > 0) this.lignes.push({ texte: '', couleur: this.couleur });
                const ligne = this.lignes[this.lignes.length - 1];
                ligne.couleur = this.couleur;
                for (const car of morceau[1]) {   // retour a la ligne automatique en bout d'ecran
                    ecranCtx.font = '14px "Segoe UI", Arial, sans-serif';
                    const courante = this.lignes[this.lignes.length - 1];
                    if (ecranCtx.measureText(courante.texte + car).width > 124) this.lignes.push({ texte: car, couleur: this.couleur });
                    else courante.texte += car;
                }
            }
            this.lignes = this.lignes.slice(-8);
            this.dessiner();
        },
        ligne(t) { this.ecrire(t); this.lignes.push({ texte: '', couleur: this.couleur }); this.lignes = this.lignes.slice(-8); this.dessiner(); },
        label(t, taille, pos) { this.etiquettes[pos] = { texte: String(t), taille, couleur: this.couleur }; this.dessiner(); },
        pinceau(c) { this.couleur = c; },
        effacer() { this.lignes = [{ texte: '', couleur: this.couleur }]; this.etiquettes = {}; this.dessiner(); },
        dessiner() {
            const c = ecranCtx;
            c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128);
            c.textBaseline = 'top'; c.textAlign = 'left';
            c.font = '14px "Segoe UI", Arial, sans-serif';
            this.lignes.forEach((l, i) => { c.fillStyle = l.couleur; c.fillText(l.texte, 2, 2 + i * 16); });
            for (const [pos, e] of Object.entries(this.etiquettes)) {
                c.font = Math.round(e.taille * 0.85) + 'px "Segoe UI", Arial, sans-serif';
                c.fillStyle = e.couleur;
                const [h, v] = { center: ['c', 'm'], top_left: ['g', 'h'], top_mid: ['c', 'h'], top_right: ['d', 'h'], mid_left: ['g', 'm'],
                                 mid_right: ['d', 'm'], bottom_left: ['g', 'b'], bottom_mid: ['c', 'b'], bottom_right: ['d', 'b'] }[pos] || ['c', 'm'];
                c.textAlign = { g: 'left', c: 'center', d: 'right' }[h];
                c.textBaseline = { h: 'top', m: 'middle', b: 'bottom' }[v];
                c.fillText(e.texte, { g: 3, c: 64, d: 125 }[h], { h: 3, m: 64, b: 125 }[v]);
            }
        },
    };
    ecran.dessiner();

    // ---------- LED du CyberPi ----------
    let luminositeLed = 100;
    const ledsDom = Array.from(document.querySelectorAll('#cyberpi-leds .cp-led'));
    function majLeds() {
        ledsDom.forEach((el, i) => {
            const [r, g, b] = ledsRobot[i].map(c => Math.round(c * luminositeLed / 100));
            const allumee = r || g || b;
            el.style.background = allumee ? 'rgb(' + r + ',' + g + ',' + b + ')' : '';
            el.style.boxShadow = allumee ? '0 0 10px 3px rgba(' + r + ',' + g + ',' + b + ',0.8)' : '';
        });
    }
    function poserLed(id, r, g, b) {
        const c = [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(Number(x) || 0))));
        if (id === 'all') ledsRobot.forEach((_, i) => { ledsRobot[i] = c.slice(); });
        else { const i = Number(id) - 1; if (i >= 0 && i < 5) ledsRobot[i] = c; }
        majLeds();
    }

    // ---------- Son (Web Audio) ----------
    let audio = null, volume = 50, oscillateur = null;
    function jouerFrequence(f, duree) {
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            arreterSon();
            const o = audio.createOscillator(), g = audio.createGain();
            o.type = 'square'; o.frequency.value = Math.max(20, Math.min(5000, f));
            g.gain.value = 0.15 * volume / 100;
            o.connect(g).connect(audio.destination);
            o.start(); o.stop(audio.currentTime + duree);
            oscillateur = o;
        } catch (e) { /* pas de son disponible : la simulation continue */ }
        $('v-son').textContent = 'Son : ' + Math.round(f) + ' Hz';
    }
    function arreterSon() { if (oscillateur) { try { oscillateur.stop(); } catch (e) { /* deja arrete */ } oscillateur = null; } $('v-son').textContent = 'Son : —'; }
    // Evocation des sons enregistres du CyberPi (les vrais sont des enregistrements) ; inconnu : simple « ding ».
    const MELODIES = { hello: [[72, 0.12], [76, 0.12], [79, 0.2]], yeah: [[67, 0.1], [79, 0.3]], wow: [[64, 0.15], [71, 0.15], [76, 0.3]],
                       laugh: [[76, 0.08], [74, 0.08], [76, 0.08], [74, 0.08], [76, 0.08]], right: [[76, 0.1], [84, 0.25]], wrong: [[52, 0.15], [48, 0.35]],
                       'level-up': [[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.35]], score: [[84, 0.08], [88, 0.2]], laser: [[96, 0.05], [90, 0.05], [84, 0.05], [78, 0.1]],
                       beeps: [[81, 0.08], [0, 0.06], [81, 0.08], [0, 0.06], [81, 0.08]], ding: [[88, 0.3]] };
    const freqMidi = m => 440 * Math.pow(2, (m - 69) / 12);

    // ---------- Capteurs du CyberPi (curseurs) et boutons ----------
    const curseurs = { lumiere: 'r-lumiere', bruit: 'r-bruit', batterie: 'r-batterie' };
    for (const [cle, id] of Object.entries(curseurs)) {
        const maj = () => { $('v-' + cle).textContent = $(id).value + ' %'; };
        $(id).addEventListener('input', maj); maj();
    }
    let secousse = 0;
    $('btn-secouer').addEventListener('click', () => { secousse = performance.now(); });
    const enfonces = new Set();
    document.querySelectorAll('[data-bouton]').forEach(el => {
        const nom = el.dataset.bouton;
        const appuyer = (e) => { e.preventDefault(); enfonces.add(nom); el.classList.add('appuye'); if (execution) execution.declencher('bouton', nom); };
        const relacher = () => { enfonces.delete(nom); el.classList.remove('appuye'); };
        el.addEventListener('pointerdown', appuyer);
        el.addEventListener('pointerup', relacher);
        el.addEventListener('pointerleave', relacher);
    });

    // ---------- Execution d'un programme ----------
    const ARRET = { arret: true };
    let execution = null;
    function console_(texte, classe) { if (window.consoleAjouterLigne) window.consoleAjouterLigne(texte, classe); }

    function texte(x) {   // conversion en texte a la maniere de Python (str)
        if (x === true) return 'True';
        if (x === false) return 'False';
        if (x === null || x === undefined) return 'None';
        if (Array.isArray(x)) return '[' + x.map(e => typeof e === 'string' ? "'" + e + "'" : texte(e)).join(', ') + ']';
        if (typeof x === 'number' && !Number.isInteger(x)) return String(Math.round(x * 1e6) / 1e6);
        return String(x);
    }
    function index(liste, ou, at, insertion) {
        const n = liste.length;
        switch (ou) {
            case 'FIRST': return 0;
            case 'LAST': return insertion ? n : n - 1;
            case 'FROM_END': return n - Number(at);
            case 'RANDOM': return Math.floor(Math.random() * (insertion ? n + 1 : n));
            default: return Number(at) - 1;
        }
    }

    function creerExecution(code) {
        const run = { actif: true, gestionnaires: [], enCours: new Set(), attentes: new Set(), debut: horloge.t };
        // Attentes sur l'horloge de simulation (pas sur setTimeout) : voir la boucle d'animation.
        const dormir = (ms) => new Promise(res => {
            const a = { t: horloge.t + Math.max(0, Number(ms) || 0) / 1000 };
            a.fin = () => { run.attentes.delete(a.fin); const i = horloge.attentes.indexOf(a); if (i >= 0) horloge.attentes.splice(i, 1); res(); };
            horloge.attentes.push(a);
            run.attentes.add(a.fin);
        }).then(() => { if (!run.actif) throw ARRET; });
        const verifier = () => { if (!run.actif) throw ARRET; };
        const fixer = (g, d) => {
            if (robot.but) { const fin = robot.but.fin; robot.but = null; fin(); }   // un nouvel ordre interrompt « avancer de … cm »
            robot.cibleG = Math.max(-RPM_MAX, Math.min(RPM_MAX, Number(g) || 0)); robot.cibleD = Math.max(-RPM_MAX, Math.min(RPM_MAX, Number(d) || 0)); };

        const R = {
            sur(evenement, cle, fn) { run.gestionnaires.push({ evenement, cle, fn }); },
            pas: () => dormir(0),
            attendre: (s) => dormir(Number(s) * 1000),
            vrai: (x) => Array.isArray(x) ? x.length > 0 : !!x,
            texte,
            modulo: (a, b) => { a = Number(a); b = Number(b); return ((a % b) + b) % b; },
            hasard: (a, b) => { a = Math.ceil(Number(a)); b = Math.floor(Number(b)); if (a > b) [a, b] = [b, a]; return a + Math.floor(Math.random() * (b - a + 1)); },
            listeLire(liste, mode, ou, at) {
                if (!Array.isArray(liste)) return null;
                const i = index(liste, ou, at, false);
                const valeurLue = liste[i];
                if (mode !== 'GET') liste.splice(i, 1);
                return valeurLue === undefined ? null : valeurLue;
            },
            listeEcrire(liste, mode, ou, at, val) {
                if (!Array.isArray(liste)) return;
                const i = index(liste, ou, at, mode === 'INSERT');
                if (mode === 'INSERT') liste.splice(i, 0, val); else liste[i] = val;
            },
            diffuser(msg) { setTimeout(() => execution === api && api.declencher('message', msg), 0); },

            // --- deplacements ---
            async mbot2(sens, v, t) {
                verifier();
                v = Number(v) || 0;
                const roues = { forward: [v, v], backward: [-v, -v], turn_left: [-v, v], turn_right: [v, -v] }[sens];
                fixer(roues[0], roues[1]);
                if (t !== null && t !== undefined) { await dormir(Number(t) * 1000); fixer(0, 0); }
            },
            // straight(cm) et turn(°) a 50 tr/min (vitesse par defaut de l'API mbot2), mesures par les encodeurs.
            async droit(d) {
                verifier();
                d = Number(d) || 0;
                await mouvementMesure(Math.sign(d) * 50, Math.sign(d) * 50, Math.abs(d) / (Math.PI * ROUE_D) * 360);
                verifier();
            },
            async tourner(a) {
                verifier();
                a = Number(a) || 0;   // pivot sur place : chaque roue parcourt un arc de rayon ENTRAXE / 2
                await mouvementMesure(Math.sign(a) * 50, -Math.sign(a) * 50, Math.abs(a) * ENTRAXE / ROUE_D);
                verifier();
            },
            puissance: (g, d) => { verifier(); fixer(Number(g) * 2, Number(d) * 2); },
            vitesses: (g, d) => { verifier(); fixer(g, d); },
            stop(port) { verifier(); if (port !== 'EM2') robot.cibleG = 0; if (port !== 'EM1') robot.cibleD = 0; },
            vitesseMoteur(port, v) { verifier(); if (port === 'EM1') fixer(v, robot.cibleD); else fixer(robot.cibleG, v); },
            razAngle(port) { if (port !== 'EM2') robot.angleG = 0; if (port !== 'EM1') robot.angleD = 0; },
            angleMoteur: (port) => Math.round(port === 'EM1' ? robot.angleG : robot.angleD),
            vitesseLue: (port) => Math.round(port === 'EM1' ? robot.rpmG : robot.rpmD),

            // --- capteurs mBuild ---
            distance: mesureUltrasons,
            ligne: (c) => c === 'any' ? Object.keys(QUAD_L).some(voitLigne) : voitLigne(c),
            ecartLigne,
            gris,
            couleurSol: (c) => { const [x, y] = avant(QUAD_F, QUAD_L[c] || 0); return nomCouleur(couleurSolEn(x, y)); },

            // --- ecran, LED, son ---
            ecran,
            print: (t) => console_('[simulation] ' + t, 'robot'),
            led: poserLed,
            luminositeLed: (l) => { luminositeLed = Math.max(0, Math.min(100, Number(l) || 0)); majLeds(); },
            async animation(nom) {
                const COUL = { rainbow: null, spoondrift: [0, 120, 255], meteor_blue: [0, 60, 255], meteor_green: [0, 220, 60],
                               flash_red: [255, 0, 0], flash_orange: [255, 120, 0], firefly: [200, 255, 0] }[nom];
                const ARC = [[255, 0, 0], [255, 150, 0], [255, 255, 0], [0, 200, 0], [0, 80, 255]];
                for (let pas = 0; pas < 15; pas++) {
                    for (let i = 0; i < 5; i++) {
                        const c = COUL ? ((i + pas) % 5 === 0 || nom.startsWith('flash') && pas % 2 === 0 ? COUL : [0, 0, 0]) : ARC[(i + pas) % 5];
                        ledsRobot[i] = c.slice();
                    }
                    majLeds();
                    await dormir(100);
                }
                ledsRobot.forEach((_, i) => { ledsRobot[i] = [0, 0, 0]; }); majLeds();
            },
            async note(midi, temps) { verifier(); jouerFrequence(freqMidi(midi), temps); await dormir(temps * 1000); },
            async son(f, t) { verifier(); jouerFrequence(Number(f), Number(t)); await dormir(Number(t) * 1000); },
            async sonEnregistre(nom) {
                for (const [m, d] of MELODIES[nom] || MELODIES.ding) { if (m) jouerFrequence(freqMidi(m), d); else arreterSon(); await dormir(d * 1000); }
            },
            volume: (v) => { volume = Math.max(0, Math.min(100, Number(v) || 0)); },
            arreterSon,

            // --- capteurs du CyberPi ---
            bouton: (nom) => enfonces.has(nom),
            capteur: (cle) => Number($(curseurs[cle]).value),
            inclinaison(axe) {
                if (axe !== 'yaw') return 0;   // robot pose a plat
                let cap = (robot.a - robot.cap0) * 180 / Math.PI;
                cap = ((cap + 180) % 360 + 360) % 360 - 180;
                return Math.round(cap);
            },
            razCap() { robot.cap0 = robot.a; },
            secoue: () => performance.now() - secousse < 500,
            chrono: () => Math.round((horloge.t - run.debut) * 100) / 100,
            razChrono() { run.debut = horloge.t; },
        };

        const api = {
            run,
            demarrer() {
                let preparer;
                try {
                    preparer = new Function('R', 'V', 'FN', '"use strict";\n' + code);
                } catch (e) {
                    console_('Le programme n\'a pas pu être préparé : ' + e.message, 'err');
                    return false;
                }
                try { preparer(R, {}, {}); } catch (e) { console_('Erreur au démarrage : ' + e.message, 'err'); return false; }
                api.declencher('start', '');
                return true;
            },
            declencher(evenement, cle) {
                if (!run.actif) return;
                for (const g of run.gestionnaires) {
                    if (g.evenement !== evenement || (evenement !== 'start' && g.cle !== cle) || run.enCours.has(g)) continue;
                    run.enCours.add(g);   // un evenement deja en cours n'est pas relance (comme sur le CyberPi)
                    g.fn().catch(e => {
                        if (e === ARRET) return;
                        console_('Erreur dans le programme : ' + (e && e.message ? e.message : e), 'err');
                    }).finally(() => run.enCours.delete(g));
                }
            },
            arreter() {
                run.actif = false;
                if (robot.but) { const fin = robot.but.fin; robot.but = null; fin(); }
                for (const fin of Array.from(run.attentes)) fin();
                fixer(0, 0);
                arreterSon();
            },
        };
        return api;
    }

    function lancer(code) {
        arreter();
        robot.angleG = 0; robot.angleD = 0; robot.cap0 = robot.a;
        ecran.reinitialiser();
        ledsRobot.forEach((_, i) => { ledsRobot[i] = [0, 0, 0]; }); luminositeLed = 100; majLeds();
        volume = 50;
        execution = creerExecution(code);
        window.simuEnCours = true;
        if (!execution.demarrer()) arreter();
        else console_('Simulation lancée.', 'info');
    }
    function arreter() {
        if (execution) { execution.arreter(); execution = null; console_('Simulation arrêtée.', 'info'); }
        window.simuEnCours = false;
    }

    // ---------- Boucle d'animation et horloge de simulation ----------
    // Le temps avance par pas de 5 ms (temps reel, une seconde au plus par image). Apres chaque pas, les attentes
    // du programme arrivees a echeance sont reveillees, et le programme s'execute jusqu'a sa prochaine attente avant
    // le pas suivant (une « macro-tache » laisse se terminer tout ce qui a ete reveille). Le programme voit donc ses
    // capteurs toutes les 5 ms, meme si l'affichage ralentit (onglet en arriere-plan, ordinateur charge) :
    // la simulation reste juste, elle va seulement moins vite a l'ecran.
    const canal = new MessageChannel(), suites = [];
    canal.port1.onmessage = () => { const s = suites.shift(); if (s) s(); };
    const macrotache = () => new Promise(r => { suites.push(r); canal.port2.postMessage(0); });
    let precedent = performance.now(), compteurMesures = 0;
    async function boucle(t) {
        let reste = Math.min(1, Math.max(0, (t - precedent) / 1000));
        precedent = t;
        while (reste > 1e-6) {
            const pas = Math.min(0.005, reste);
            avancer(pas);
            horloge.t += pas; reste -= pas;
            const prets = horloge.attentes.filter(a => a.t <= horloge.t + 1e-9);
            for (const a of prets) a.fin();
            if (execution) await macrotache();
        }
        precedent = Math.max(precedent, performance.now() - 50);   // le temps passe a executer le programme n'est pas rattrape
        dessiner();
        if (++compteurMesures % 6 === 0) majMesures();
        requestAnimationFrame(boucle);
    }

    // ---------- Manipulation a la souris ----------
    let prise = null;
    const versCm = (e) => {
        const r = canevas.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width * LARGEUR, (e.clientY - r.top) / r.height * HAUTEUR];
    };
    const obstacleSous = (x, y) => obstacles.slice().reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
    canevas.addEventListener('pointerdown', (e) => {
        const [x, y] = versCm(e);
        if (Math.hypot(x - robot.x, y - robot.y) < 10) prise = { cible: robot, dx: robot.x - x, dy: robot.y - y };
        else { const o = obstacleSous(x, y); if (o) prise = { cible: o, dx: o.x - x, dy: o.y - y }; }
        if (prise) { canevas.setPointerCapture(e.pointerId); canevas.classList.add('glisse'); }
    });
    canevas.addEventListener('pointermove', (e) => {
        if (!prise) return;
        const [x, y] = versCm(e);
        prise.cible.x = Math.max(0, Math.min(LARGEUR - (prise.cible.w || 0), x + prise.dx));
        prise.cible.y = Math.max(0, Math.min(HAUTEUR - (prise.cible.h || 0), y + prise.dy));
    });
    const lacher = () => { prise = null; canevas.classList.remove('glisse'); };
    canevas.addEventListener('pointerup', lacher);
    canevas.addEventListener('pointercancel', lacher);
    canevas.addEventListener('wheel', (e) => {
        const [x, y] = versCm(e);
        if (Math.hypot(x - robot.x, y - robot.y) > 12) return;
        e.preventDefault();
        robot.a += (e.deltaY > 0 ? 15 : -15) * Math.PI / 180;
    }, { passive: false });
    canevas.addEventListener('dblclick', (e) => {
        const [x, y] = versCm(e), o = obstacleSous(x, y);
        if (o) obstacles.splice(obstacles.indexOf(o), 1);
    });
    $('btn-obstacle').addEventListener('click', () => {
        const o = { x: 90, y: 20, w: 20, h: 20 };
        if (Math.hypot(robot.x - 100, robot.y - 30) < 25) o.y = 105;
        obstacles.push(o);
    });
    $('btn-replacer').addEventListener('click', replacer);
    $('voir-capteurs').addEventListener('change', (e) => { voirCapteurs = e.target.checked; });

    const choix = $('choix-piste');
    for (const [cle, p] of Object.entries(PISTES)) {
        const o = document.createElement('option'); o.value = cle; o.textContent = p.nom; choix.appendChild(o);
    }
    let pisteMemo = 'ovale';
    try { pisteMemo = localStorage.getItem('mbot2_piste') || 'ovale'; } catch (e) { /* navigation privee */ }
    chargerPiste(pisteMemo);
    choix.value = piste;
    choix.addEventListener('change', () => chargerPiste(choix.value));
    requestAnimationFrame(boucle);

    window.Simulateur = {
        lancer, arreter, chargerPiste,
        enCours: () => !!execution,
        // pour les tests (console du navigateur) : etat du robot et des capteurs
        etat: () => ({ x: robot.x, y: robot.y, angle: robot.a * 180 / Math.PI, rpmG: robot.rpmG, rpmD: robot.rpmD,
                       distance: mesureUltrasons(), ligne: Object.keys(QUAD_L).map(voitLigne), ecart: ecartLigne(), leds: ledsRobot.map(l => l.slice()) }),
        placer: (x, y, a) => Object.assign(robot, { x, y, a: a * Math.PI / 180 }),
    };
})();
