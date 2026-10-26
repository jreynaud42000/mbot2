// exemples_aide.js — un petit programme d'exemple pour chaque bloc mBot2, montre dans « Aide sur ce bloc » (app.js) :
// dessine en blocs (lecture seule), avec son code Python et le bouton « Insérer l'exemple ».
// Meme principe que les EXEMPLES_BLOCS de l'editeur micro:bit (blockly_ts_mode_classe/un.js).
//
// Chaque exemple : titre, texte (ce qu'il fait), blocs (piles de blocs au format de serialisation Blockly, sans x/y).
// Plusieurs types de blocs peuvent partager le meme exemple.

(function () {
    'use strict';
    // --- Outils d'ecriture des blocs ---
    const n = v => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
    const t = v => ({ shadow: { type: 'text', fields: { TEXT: v } } });
    const val = (type, champs, entrees) => ({ block: B(type, champs, entrees) });
    function B(type, champs, entrees, extra) {
        return Object.assign({ type }, champs ? { fields: champs } : {}, entrees ? { inputs: entrees } : {}, extra || {});
    }
    /** Accroche les blocs les uns sous les autres et renvoie le premier. */
    function pile(...blocs) {
        for (let i = blocs.length - 2; i >= 0; i--) blocs[i].next = { block: blocs[i + 1] };
        return blocs[0];
    }
    const sous = (chapeau, ...suite) => (suite.length ? Object.assign(chapeau, { next: { block: pile(...suite) } }) : chapeau);
    const demarrage = (...suite) => sous(B('mb_demarrage'), ...suite);
    const quandBouton = (bouton, ...suite) => sous(B('mb_quand_bouton', { BOUTON: bouton }), ...suite);
    const toujours = (...corps) => B('mb_toujours', null, { DO: { block: pile(...corps) } });
    const si = (condition, alors, sinon) => B('controls_if', null,
        Object.assign({ IF0: { block: condition }, DO0: { block: alors } }, sinon ? { ELSE: { block: sinon } } : {}),
        sinon ? { extraState: { hasElse: true } } : null);
    const compare = (a, op, b) => B('logic_compare', { OP: op }, { A: { block: a }, B: n(b) });
    const joindre = (texte, bloc) => B('text_join', null, { ADD0: t(texte), ADD1: { block: bloc } }, { extraState: { itemCount: 2 }, inline: true });
    const label = (bloc) => B('mb_ecran_label', { TAILLE: '32', POS: 'center' }, { TEXTE: { block: bloc } });
    const ligne = (texte) => B('mb_ecran_ligne', null, { TEXTE: t(texte) });
    const ligneBloc = (bloc) => B('mb_ecran_ligne', null, { TEXTE: { block: bloc } });
    const attendre = (s) => B('mb_attendre', null, { S: n(s) });
    const led = (couleur, quelle) => B('mb_led_couleur', { LED: quelle || 'all', COULEUR: couleur });
    const eteindre = () => B('mb_led_eteindre', { LED: 'all' });
    const stop = () => B('mb_stop');
    const roues = (g, d) => B('mb_vitesse_roues', null, { G: n(g), D: n(d) });

    const EXEMPLES = [
        { types: ['mb_demarrage'], titre: 'Dire bonjour au démarrage',
          texte: 'Au démarrage, le CyberPi écrit « Bonjour ! » sur son écran et allume ses LED en vert.',
          blocs: [demarrage(ligne('Bonjour !'), led('#00ff00'))] },
        { types: ['mb_quand_bouton'], titre: 'Partir quand on appuie sur A',
          texte: 'Chaque appui sur le bouton A fait avancer le robot pendant 1 seconde.',
          blocs: [quandBouton('a', B('mb_avancer_pendant', { SENS: 'forward' }, { V: n(50), T: n(1) }))] },
        { types: ['mb_quand_recu', 'mb_diffuser'], titre: 'Un message entre deux parties du programme',
          texte: 'Le bouton A diffuse le message « fete » ; la partie « quand je reçois fete » joue un son et une animation.',
          blocs: [quandBouton('a', B('mb_diffuser', { MSG: 'fete' })),
                  sous(B('mb_quand_recu', { MSG: 'fete' }), B('mb_son_jouer', { SON: 'yeah' }), B('mb_led_animation', { ANIM: 'rainbow' }))] },

        { types: ['mb_attendre'], titre: 'Clignoter une fois',
          texte: 'Les LED s\'allument en rouge, le programme attend 1 seconde, puis les éteint.',
          blocs: [demarrage(led('#ff0000'), attendre(1), eteindre())] },
        { types: ['mb_attendre_jusqua'], titre: 'Attendre le signal de départ',
          texte: 'Le robot attend qu\'on appuie sur A, puis avance de 30 cm.',
          blocs: [demarrage(ligne('Appuie sur A'), B('mb_attendre_jusqua', null, { COND: val('mb_bouton', { BOUTON: 'a' }) }),
                            B('mb_distance_cm', { SENS: '1' }, { D: n(30) }))] },
        { types: ['mb_toujours', 'mb_distance'], titre: 'Afficher la distance en continu',
          texte: 'Le CyberPi affiche sans arrêt la distance mesurée par les ultrasons, 5 fois par seconde.',
          blocs: [demarrage(toujours(label(B('mb_distance')), attendre(0.2)))] },

        { types: ['mb_avancer_pendant'], titre: 'Aller-retour',
          texte: 'Le robot avance 2 secondes, puis recule 2 secondes : il revient à son point de départ.',
          blocs: [demarrage(B('mb_avancer_pendant', { SENS: 'forward' }, { V: n(50), T: n(2) }),
                            B('mb_avancer_pendant', { SENS: 'backward' }, { V: n(50), T: n(2) }))] },
        { types: ['mb_tourner_pendant'], titre: 'Faire un tour sur place',
          texte: 'Le robot pivote vers la gauche pendant 3 secondes, puis vers la droite pendant 3 secondes.',
          blocs: [demarrage(B('mb_tourner_pendant', { SENS: 'turn_left' }, { V: n(50), T: n(3) }),
                            B('mb_tourner_pendant', { SENS: 'turn_right' }, { V: n(50), T: n(3) }))] },
        { types: ['mb_mouvement', 'mb_stop'], titre: 'S\'arrêter devant un obstacle',
          texte: 'Le robot avance sans s\'arrêter jusqu\'à ce qu\'un obstacle soit à moins de 15 cm, puis il s\'arrête.',
          blocs: [demarrage(B('mb_mouvement', { SENS: 'forward' }, { V: n(50) }),
                            B('mb_attendre_jusqua', null, { COND: { block: compare(B('mb_distance'), 'LT', 15) } }), stop())] },
        { types: ['mb_distance_cm'], titre: 'Demi-tour',
          texte: 'Le robot avance de 30 cm, fait demi-tour (180°) et revient de 30 cm.',
          blocs: [demarrage(B('mb_distance_cm', { SENS: '1' }, { D: n(30) }), B('mb_tourner_angle', { SENS: '1' }, { A: n(180) }),
                            B('mb_distance_cm', { SENS: '1' }, { D: n(30) }))] },
        { types: ['mb_tourner_angle'], titre: 'Tracer un carré',
          texte: 'Quatre fois : avancer de 20 cm puis tourner de 90° à droite.',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(4), DO: { block: pile(
                    B('mb_distance_cm', { SENS: '1' }, { D: n(20) }), B('mb_tourner_angle', { SENS: '1' }, { A: n(90) })) } }))] },
        { types: ['mb_puissance'], titre: 'Grand virage',
          texte: 'La roue gauche reçoit plus de puissance que la droite : le robot décrit un arc vers la droite pendant 3 secondes.',
          blocs: [demarrage(B('mb_puissance', null, { G: n(60), D: n(25) }), attendre(3), stop())] },
        { types: ['mb_vitesse_roues'], titre: 'Décrire un cercle',
          texte: 'Roue gauche à 60 tr/min, roue droite à 30 tr/min : le robot tourne en rond vers la droite pendant 5 secondes.',
          blocs: [demarrage(roues(60, 30), attendre(5), stop())] },

        { types: ['mb_em_vitesse', 'mb_em_stop', 'mb_em_raz', 'mb_em_angle'], titre: 'Mesurer un tour de roue',
          texte: 'L\'angle de la roue gauche est remis à zéro, la roue tourne 2 secondes, puis l\'écran affiche l\'angle parcouru (360° = un tour).',
          blocs: [demarrage(B('mb_em_raz', { PORT: 'EM1' }), B('mb_em_vitesse', { PORT: 'EM1' }, { V: n(30) }), attendre(2),
                            B('mb_em_stop', { PORT: 'EM1' }), ligneBloc(joindre('Angle : ', B('mb_em_angle', { PORT: 'EM1' }))))] },
        { types: ['mb_em_vitesse_lue'], titre: 'Lire la vitesse d\'une roue',
          texte: 'Le robot roule à 60 tr/min ; au bout d\'une seconde, l\'écran affiche la vitesse mesurée par l\'encodeur gauche.',
          blocs: [demarrage(roues(60, 60), attendre(1), ligneBloc(joindre('Vitesse : ', B('mb_em_vitesse_lue', { PORT: 'EM1' }))), stop())] },

        { types: ['mb_ligne'], titre: 'Suivre une ligne noire',
          texte: 'Si le capteur L1 voit la ligne, le robot tourne vers la gauche ; sinon il tourne vers la droite. Il ondule ainsi le long du bord de la ligne.',
          blocs: [demarrage(toujours(si(B('mb_ligne', { CAPTEUR: 'L1' }), roues(15, 45), roues(45, 15))))] },
        { types: ['mb_ecart_ligne'], titre: 'Afficher l\'écart à la ligne',
          texte: 'Posez le robot sur une ligne et déplacez-le : l\'écran affiche l\'écart, de -100 à 100 (0 = ligne centrée).',
          blocs: [demarrage(toujours(label(B('mb_ecart_ligne')), attendre(0.2)))] },
        { types: ['mb_gris'], titre: 'Mesurer la lumière renvoyée par le sol',
          texte: 'L\'écran affiche la lumière réfléchie sous le capteur L1 : forte sur du blanc, faible sur du noir.',
          blocs: [demarrage(toujours(label(B('mb_gris', { CAPTEUR: 'L1' })), attendre(0.2)))] },
        { types: ['mb_couleur_est'], titre: 'S\'arrêter sur le rouge',
          texte: 'Le robot avance jusqu\'à ce que le capteur L1 voie du rouge, puis il s\'arrête et joue un son (piste « Zones de couleur »).',
          blocs: [demarrage(B('mb_mouvement', { SENS: 'forward' }, { V: n(40) }),
                            B('mb_attendre_jusqua', null, { COND: val('mb_couleur_est', { CAPTEUR: 'L1', COULEUR: 'red' }) }),
                            stop(), B('mb_son_jouer', { SON: 'right' }))] },

        { types: ['mb_ecran_ligne', 'mb_ecran_ecrire', 'mb_ecran_couleur'], titre: 'Écrire en couleur',
          texte: 'Le texte jaune « Bonjour » passe à la ligne ; « mBot2 » puis « ! » s\'écrivent ensuite à la suite, en cyan.',
          blocs: [demarrage(B('mb_ecran_couleur', { COULEUR: '#ffff00' }), ligne('Bonjour'), B('mb_ecran_couleur', { COULEUR: '#00ffff' }),
                            B('mb_ecran_ecrire', null, { TEXTE: t('mBot2') }), B('mb_ecran_ecrire', null, { TEXTE: t(' !') }))] },
        { types: ['mb_ecran_label'], titre: 'Un titre et un compteur',
          texte: 'Un titre reste en haut de l\'écran pendant qu\'un nombre change au centre : chaque position garde son propre texte.',
          blocs: [demarrage(B('mb_ecran_label', { TAILLE: '16', POS: 'top_mid' }, { TEXTE: t('Chronomètre') }),
                            toujours(label(B('mb_chrono')), attendre(0.1)))] },
        { types: ['mb_ecran_effacer'], titre: 'Effacer l\'écran',
          texte: 'Un message s\'affiche pendant 2 secondes, puis l\'écran est effacé.',
          blocs: [demarrage(ligne('Attention…'), attendre(2), B('mb_ecran_effacer'))] },
        { types: ['mb_print'], titre: 'Relever des mesures sur l\'ordinateur',
          texte: 'Le robot envoie la distance à l\'ordinateur deux fois par seconde. Sur le vrai robot, cliquez sur « Écouter le robot » dans la console.',
          blocs: [demarrage(toujours(B('mb_print', null, { TEXTE: { block: joindre('distance : ', B('mb_distance')) } }), attendre(0.5)))] },

        { types: ['mb_led_couleur', 'mb_led_rvb', 'mb_led_eteindre'], titre: 'Feu tricolore',
          texte: 'Toutes les LED s\'allument en rouge, puis la LED 3 passe au vert (mélange rouge 0, vert 255, bleu 0), puis tout s\'éteint.',
          blocs: [demarrage(led('#ff0000'), attendre(1), B('mb_led_rvb', { LED: '3' }, { R: n(0), V: n(255), B: n(0) }), attendre(1), eteindre())] },
        { types: ['mb_led_animation'], titre: 'Arc-en-ciel',
          texte: 'Les cinq LED jouent l\'animation arc-en-ciel ; le programme attend qu\'elle soit finie pour écrire « Fini ».',
          blocs: [demarrage(B('mb_led_animation', { ANIM: 'rainbow' }), ligne('Fini'))] },
        { types: ['mb_led_luminosite'], titre: 'Des LED moins éblouissantes',
          texte: 'La luminosité est réglée à 20 % avant d\'allumer les LED en blanc.',
          blocs: [demarrage(B('mb_led_luminosite', null, { L: n(20) }), led('#ffffff'))] },

        { types: ['mb_son_note'], titre: 'Jouer un accord',
          texte: 'Le CyberPi joue do, mi, sol puis do aigu.',
          blocs: [demarrage(...[['60', '0.5'], ['64', '0.5'], ['67', '0.5'], ['72', '1']].map(([note, duree]) => B('mb_son_note', { NOTE: note, DUREE: duree })))] },
        { types: ['mb_son_frequence'], titre: 'Une sirène',
          texte: 'Trois fois : un son grave (440 Hz) puis un son aigu (880 Hz).',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(3), DO: { block: pile(
                    B('mb_son_frequence', null, { F: n(440), T: n(0.4) }), B('mb_son_frequence', null, { F: n(880), T: n(0.4) })) } }))] },
        { types: ['mb_son_jouer', 'mb_son_volume'], titre: 'Bonjour, moins fort',
          texte: 'Le volume est réglé à 30 % ; chaque appui sur A fait dire « bonjour » au robot.',
          blocs: [demarrage(B('mb_son_volume', null, { V: n(30) })), quandBouton('a', B('mb_son_jouer', { SON: 'hello' }))] },
        { types: ['mb_son_stop'], titre: 'Couper le son',
          texte: 'Le bouton A lance une musique ; le bouton B arrête tous les sons.',
          blocs: [quandBouton('a', B('mb_son_jouer', { SON: 'level-up' })), quandBouton('b', B('mb_son_stop'))] },

        { types: ['mb_bouton'], titre: 'Lampe à bouton',
          texte: 'Tant que le bouton A est enfoncé, les LED sont vertes ; sinon elles sont éteintes.',
          blocs: [demarrage(toujours(si(B('mb_bouton', { BOUTON: 'a' }), led('#00ff00'), eteindre())))] },
        { types: ['mb_luminosite'], titre: 'Veilleuse',
          texte: 'Quand la lumière ambiante descend sous 20 %, les LED s\'allument en blanc ; sinon elles s\'éteignent.',
          blocs: [demarrage(toujours(si(compare(B('mb_luminosite'), 'LT', 20), led('#ffffff'), eteindre())))] },
        { types: ['mb_bruit'], titre: 'Détecteur de bruit',
          texte: 'Si le bruit dépasse 50 %, les LED passent au rouge ; sinon elles sont vertes.',
          blocs: [demarrage(toujours(si(compare(B('mb_bruit'), 'GT', 50), led('#ff0000'), led('#00ff00'))))] },
        { types: ['mb_inclinaison', 'mb_raz_cap'], titre: 'Mesurer un virage',
          texte: 'Le cap est remis à zéro, le robot pivote 1 seconde, puis l\'écran affiche l\'angle dont il a tourné.',
          blocs: [demarrage(B('mb_raz_cap'), B('mb_tourner_pendant', { SENS: 'turn_right' }, { V: n(50), T: n(1) }),
                            ligneBloc(joindre('Cap : ', B('mb_inclinaison', { AXE: 'yaw' }))))] },
        { types: ['mb_secoue'], titre: 'Robot chatouilleux',
          texte: 'Quand on secoue le CyberPi, il rit.',
          blocs: [demarrage(toujours(si(B('mb_secoue'), B('mb_son_jouer', { SON: 'laugh' }))))] },
        { types: ['mb_chrono', 'mb_chrono_raz'], titre: 'Mesurer un temps de réaction',
          texte: 'Le chronomètre part quand les LED s\'allument ; il s\'arrête à l\'appui sur A et l\'écran affiche le temps en secondes.',
          blocs: [demarrage(attendre(2), led('#ff0000'), B('mb_chrono_raz'),
                            B('mb_attendre_jusqua', null, { COND: val('mb_bouton', { BOUTON: 'a' }) }),
                            ligneBloc(joindre('Temps : ', B('mb_chrono'))))] },
        { types: ['mb_batterie'], titre: 'Niveau de la batterie',
          texte: 'L\'écran affiche la charge de la batterie, en %.',
          blocs: [demarrage(label(joindre('', B('mb_batterie'))))] },
    ];

    const parType = {};
    for (const ex of EXEMPLES) for (const type of ex.types) parType[type] = ex;
    window.EXEMPLES_AIDE_MBOT2 = parType;
})();
