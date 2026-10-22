// blocs.js — blocs du mBot2 (CyberPi + mBuild), generateur Python (MicroPython du CyberPi, forme produite par mBlock
// en mode televersement) et generateur « SIMU » (JavaScript asynchrone execute par le simulateur, simulateur.js).
//
// Conventions de signe choisies pour les eleves : sur tous les blocs, une valeur POSITIVE fait avancer la roue.
// Sur le vrai robot, le moteur droit (EM2) est monte en miroir : le generateur Python inverse donc son signe
// (avancer = mbot2.drive_power(50, -50), comme dans la documentation Makeblock).
// Sources : documentation Makeblock « CyberPi API », « CyberPi API shields » (mbot2), « mbuild » (yuque.com).

(function () {
    'use strict';
    const P = Blockly.Python;
    P.INDENT = '    ';   // 4 espaces, comme le code produit par mBlock

    // ==========================================
    // 1. DEFINITIONS DES BLOCS
    // ==========================================
    const BOUTONS = [['A', 'a'], ['B', 'b'], ['joystick vers le haut', 'up'], ['joystick vers le bas', 'down'],
                     ['joystick vers la gauche', 'left'], ['joystick vers la droite', 'right'], ['joystick appuyé', 'middle']];
    const CAPTEURS_LIGNE = [['L1 (gauche, centre)', 'L1'], ['R1 (droite, centre)', 'R1'], ['L2 (extrême gauche)', 'L2'], ['R2 (extrême droite)', 'R2']];
    const COULEURS_SOL = [['rouge', 'red'], ['jaune', 'yellow'], ['vert', 'green'], ['cyan', 'cyan'], ['bleu', 'blue'],
                          ['violet', 'purple'], ['blanc', 'white'], ['noir', 'black']];
    const MOTEURS = [['gauche (EM1)', 'EM1'], ['droit (EM2)', 'EM2']];
    const LEDS = [['toutes les LED', 'all'], ['la LED 1', '1'], ['la LED 2', '2'], ['la LED 3', '3'], ['la LED 4', '4'], ['la LED 5', '5']];
    const NOTES = [['do', '60'], ['ré', '62'], ['mi', '64'], ['fa', '65'], ['sol', '67'], ['la', '69'], ['si', '71'], ['do aigu', '72']];
    const DUREES = [['1/4 de temps', '0.25'], ['1/2 temps', '0.5'], ['1 temps', '1'], ['2 temps', '2']];
    // Sons enregistres du CyberPi (noms de la bibliotheque audio de mBlock).
    const SONS = [['bonjour', 'hello'], ['ouais !', 'yeah'], ['waouh', 'wow'], ['rire', 'laugh'], ['bonne réponse', 'right'],
                  ['mauvaise réponse', 'wrong'], ['niveau gagné', 'level-up'], ['score', 'score'], ['laser', 'laser'], ['bips', 'beeps']];
    const ANIMATIONS = [['arc-en-ciel', 'rainbow'], ['vague', 'spoondrift'], ['météore bleu', 'meteor_blue'], ['météore vert', 'meteor_green'],
                        ['éclair rouge', 'flash_red'], ['éclair orange', 'flash_orange'], ['luciole', 'firefly']];
    const POSITIONS = [['au centre', 'center'], ['en haut à gauche', 'top_left'], ['en haut au milieu', 'top_mid'], ['en haut à droite', 'top_right'],
                       ['au milieu à gauche', 'mid_left'], ['au milieu à droite', 'mid_right'], ['en bas à gauche', 'bottom_left'],
                       ['en bas au milieu', 'bottom_mid'], ['en bas à droite', 'bottom_right']];

    const nombre = (nom) => ({ type: 'input_value', name: nom, check: 'Number' });
    const valeur = (nom) => ({ type: 'input_value', name: nom });
    const menu = (nom, options) => ({ type: 'field_dropdown', name: nom, options });
    const instr = (def) => Object.assign({ previousStatement: null, nextStatement: null, inputsInline: true }, def);
    const reporteur = (def, sortie) => Object.assign({ output: sortie === undefined ? 'Number' : sortie, inputsInline: true }, def);

    Blockly.defineBlocksWithJsonArray([
        // ----- Evenements -----
        { type: 'mb_demarrage', message0: 'quand le programme démarre', nextStatement: null,
          tooltip: 'Les blocs placés dessous s\'exécutent au démarrage du robot (ou au lancement de la simulation).' },
        { type: 'mb_quand_bouton', message0: 'quand le bouton %1 est pressé', args0: [menu('BOUTON', BOUTONS)], nextStatement: null,
          tooltip: 'Les blocs placés dessous s\'exécutent à chaque appui sur ce bouton du CyberPi.' },
        { type: 'mb_quand_recu', message0: 'quand je reçois %1', args0: [{ type: 'field_input', name: 'MSG', text: 'message1' }], nextStatement: null,
          tooltip: 'Les blocs placés dessous s\'exécutent quand le programme diffuse ce message.' },
        instr({ type: 'mb_diffuser', message0: 'diffuser le message %1', args0: [{ type: 'field_input', name: 'MSG', text: 'message1' }],
          tooltip: 'Envoie un message à tout le programme : les blocs « quand je reçois » correspondants démarrent.' }),

        // ----- Controle -----
        instr({ type: 'mb_attendre', message0: 'attendre %1 secondes', args0: [nombre('S')], tooltip: 'Met le programme en pause pendant cette durée (en secondes).' }),
        instr({ type: 'mb_attendre_jusqua', message0: 'attendre jusqu\'à %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
          tooltip: 'Met le programme en pause jusqu\'à ce que la condition devienne vraie.' }),
        instr({ type: 'mb_toujours', message0: 'répéter indéfiniment %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
          nextStatement: undefined, tooltip: 'Répète les blocs à l\'intérieur sans jamais s\'arrêter.' }),

        // ----- Deplacements -----
        instr({ type: 'mb_avancer_pendant', message0: '%1 à %2 tr/min pendant %3 secondes',
          args0: [menu('SENS', [['avancer', 'forward'], ['reculer', 'backward']]), nombre('V'), nombre('T')],
          tooltip: 'Le robot avance (ou recule) à cette vitesse de roue, pendant cette durée, puis s\'arrête. Vitesse de 0 à 200 tr/min.' }),
        instr({ type: 'mb_tourner_pendant', message0: 'tourner %1 à %2 tr/min pendant %3 secondes',
          args0: [menu('SENS', [['à gauche', 'turn_left'], ['à droite', 'turn_right']]), nombre('V'), nombre('T')],
          tooltip: 'Le robot pivote sur place (les roues tournent en sens contraires) pendant cette durée, puis s\'arrête.' }),
        instr({ type: 'mb_mouvement', message0: '%1 à %2 tr/min',
          args0: [menu('SENS', [['avancer', 'forward'], ['reculer', 'backward'], ['tourner à gauche', 'turn_left'], ['tourner à droite', 'turn_right']]), nombre('V')],
          tooltip: 'Démarre le mouvement sans s\'arrêter : le robot continue jusqu\'au prochain bloc de déplacement ou « arrêter le robot ».' }),
        instr({ type: 'mb_distance_cm', message0: '%1 de %2 cm', args0: [menu('SENS', [['avancer', '1'], ['reculer', '-1']]), nombre('D')],
          tooltip: 'Le robot parcourt cette distance en ligne droite (mesurée par les encodeurs des moteurs), puis s\'arrête.' }),
        instr({ type: 'mb_tourner_angle', message0: 'tourner %1 de %2 degrés', args0: [menu('SENS', [['à droite', '1'], ['à gauche', '-1']]), nombre('A')],
          tooltip: 'Le robot pivote sur place de cet angle, puis s\'arrête.' }),
        instr({ type: 'mb_puissance', message0: 'puissance moteur gauche %1 % droit %2 %', args0: [nombre('G'), nombre('D')],
          tooltip: 'Règle la puissance de chaque roue, de -100 % à 100 %. Positif : la roue fait avancer le robot.' }),
        instr({ type: 'mb_vitesse_roues', message0: 'vitesse roue gauche %1 tr/min droite %2 tr/min', args0: [nombre('G'), nombre('D')],
          tooltip: 'Règle la vitesse de chaque roue, de -200 à 200 tr/min (régulée par les encodeurs). Positif : la roue fait avancer le robot.' }),
        instr({ type: 'mb_stop', message0: 'arrêter le robot', tooltip: 'Arrête les deux moteurs.' }),

        // ----- Moteurs a encodeur -----
        instr({ type: 'mb_em_vitesse', message0: 'faire tourner le moteur %1 à %2 tr/min', args0: [menu('PORT', MOTEURS), nombre('V')],
          tooltip: 'Fait tourner un seul moteur à cette vitesse. Positif : la roue fait avancer le robot.' }),
        instr({ type: 'mb_em_stop', message0: 'arrêter le moteur %1', args0: [menu('PORT', MOTEURS)], tooltip: 'Arrête ce moteur.' }),
        instr({ type: 'mb_em_raz', message0: 'remettre à zéro l\'angle du moteur %1', args0: [menu('PORT', MOTEURS.concat([['gauche et droit', 'all']]))],
          tooltip: 'Remet à 0 le compteur d\'angle de l\'encodeur.' }),
        reporteur({ type: 'mb_em_angle', message0: 'angle parcouru par le moteur %1 (°)', args0: [menu('PORT', MOTEURS)],
          tooltip: 'Angle total parcouru par la roue depuis la dernière remise à zéro, en degrés (360° = un tour de roue).' }),
        reporteur({ type: 'mb_em_vitesse_lue', message0: 'vitesse du moteur %1 (tr/min)', args0: [menu('PORT', MOTEURS)],
          tooltip: 'Vitesse actuelle de la roue mesurée par l\'encodeur, en tours par minute.' }),

        // ----- Capteurs mBuild -----
        reporteur({ type: 'mb_distance', message0: 'distance mesurée par les ultrasons (cm)',
          tooltip: 'Distance de l\'obstacle devant le robot, de 3 à 300 cm (300 si rien n\'est détecté).' }),
        reporteur({ type: 'mb_ligne', message0: 'le capteur %1 voit la ligne ?', args0: [menu('CAPTEUR', CAPTEURS_LIGNE.concat([['n\'importe lequel', 'any']]))] }, 'Boolean'),
        reporteur({ type: 'mb_ecart_ligne', message0: 'écart à la ligne (-100 à 100)',
          tooltip: 'Position de la ligne sous le capteur quad RGB : 0 = ligne centrée. Le signe est à vérifier sur le vrai robot avant un suivi de ligne précis.' }),
        reporteur({ type: 'mb_gris', message0: 'lumière réfléchie par le capteur %1 (%)', args0: [menu('CAPTEUR', CAPTEURS_LIGNE)],
          tooltip: 'Lumière renvoyée par le sol sous ce capteur : forte sur du blanc, faible sur du noir (0 à 100).' }),
        reporteur({ type: 'mb_couleur_est', message0: 'le capteur %1 voit la couleur %2 ?', args0: [menu('CAPTEUR', CAPTEURS_LIGNE), menu('COULEUR', COULEURS_SOL)],
          tooltip: 'Vrai si la couleur du sol sous ce capteur est celle choisie.' }, 'Boolean'),

        // ----- Ecran -----
        instr({ type: 'mb_ecran_ligne', message0: 'afficher %1 puis aller à la ligne', args0: [valeur('TEXTE')],
          tooltip: 'Écrit sur l\'écran du CyberPi, comme dans un cahier : chaque affichage passe à la ligne suivante.' }),
        instr({ type: 'mb_ecran_ecrire', message0: 'afficher %1 à la suite', args0: [valeur('TEXTE')],
          tooltip: 'Écrit sur l\'écran du CyberPi sans passer à la ligne.' }),
        instr({ type: 'mb_ecran_label', message0: 'afficher %1 en taille %2 %3', args0: [valeur('TEXTE'), menu('TAILLE', [['moyenne', '24'], ['petite', '16'], ['grande', '32']]), menu('POS', POSITIONS)],
          tooltip: 'Écrit un texte à un endroit précis de l\'écran (il remplace le texte précédent affiché au même endroit).' }),
        instr({ type: 'mb_ecran_couleur', message0: 'couleur du texte %1', args0: [{ type: 'field_colour', name: 'COULEUR', colour: '#ffffff' }],
          tooltip: 'Couleur des prochains textes affichés sur l\'écran.' }),
        instr({ type: 'mb_ecran_effacer', message0: 'effacer l\'écran', tooltip: 'Efface tout l\'écran du CyberPi.' }),
        instr({ type: 'mb_print', message0: 'écrire %1 dans la console de l\'ordinateur', args0: [valeur('TEXTE')],
          tooltip: 'Envoie un texte à l\'ordinateur par le câble USB (console, bouton « Écouter le robot »). Utile pour lire des mesures.' }),

        // ----- LED -----
        instr({ type: 'mb_led_couleur', message0: 'allumer %1 en %2', args0: [menu('LED', LEDS), { type: 'field_colour', name: 'COULEUR', colour: '#ff0000' }],
          tooltip: 'Allume une LED du CyberPi (ou les cinq) dans cette couleur.' }),
        instr({ type: 'mb_led_rvb', message0: 'allumer %1 rouge %2 vert %3 bleu %4', args0: [menu('LED', LEDS), nombre('R'), nombre('V'), nombre('B')],
          tooltip: 'Allume une LED avec un mélange de rouge, vert et bleu (chacun de 0 à 255).' }),
        instr({ type: 'mb_led_eteindre', message0: 'éteindre %1', args0: [menu('LED', LEDS)], tooltip: 'Éteint une LED du CyberPi, ou les cinq.' }),
        instr({ type: 'mb_led_animation', message0: 'jouer l\'animation lumineuse %1', args0: [menu('ANIM', ANIMATIONS)],
          tooltip: 'Joue une animation des cinq LED. Le programme attend la fin de l\'animation.' }),
        instr({ type: 'mb_led_luminosite', message0: 'luminosité des LED %1 %', args0: [nombre('L')], tooltip: 'Luminosité des LED, de 0 à 100 %.' }),

        // ----- Son -----
        instr({ type: 'mb_son_note', message0: 'jouer la note %1 pendant %2', args0: [menu('NOTE', NOTES), menu('DUREE', DUREES)],
          tooltip: 'Joue une note de musique. Un temps dure 1 seconde au tempo normal.' }),
        instr({ type: 'mb_son_frequence', message0: 'jouer un son de %1 Hz pendant %2 secondes', args0: [nombre('F'), nombre('T')],
          tooltip: 'Joue un son de cette fréquence (20 à 5000 Hz). Grave : petite fréquence, aigu : grande fréquence.' }),
        instr({ type: 'mb_son_jouer', message0: 'jouer le son %1 jusqu\'à la fin', args0: [menu('SON', SONS)], tooltip: 'Joue un son enregistré du CyberPi.' }),
        instr({ type: 'mb_son_volume', message0: 'régler le volume à %1 %', args0: [nombre('V')], tooltip: 'Volume du haut-parleur, de 0 à 100 %.' }),
        instr({ type: 'mb_son_stop', message0: 'arrêter tous les sons', tooltip: 'Arrête le son en cours.' }),

        // ----- Capteurs du CyberPi -----
        reporteur({ type: 'mb_bouton', message0: 'le bouton %1 est appuyé ?', args0: [menu('BOUTON', BOUTONS)],
          tooltip: 'Vrai tant que ce bouton du CyberPi est enfoncé.' }, 'Boolean'),
        reporteur({ type: 'mb_luminosite', message0: 'luminosité ambiante (%)', tooltip: 'Lumière reçue par le capteur du CyberPi, de 0 à 100 %.' }),
        reporteur({ type: 'mb_bruit', message0: 'intensité sonore (%)', tooltip: 'Bruit capté par le micro du CyberPi, de 0 à 100 %.' }),
        reporteur({ type: 'mb_inclinaison', message0: 'angle de %1 (°)', args0: [menu('AXE', [['tangage (avant / arrière)', 'pitch'], ['roulis (gauche / droite)', 'roll'], ['rotation (cap)', 'yaw']])],
          tooltip: 'Angle mesuré par le gyroscope du CyberPi, en degrés. La rotation (cap) dérive un peu avec le temps.' }),
        instr({ type: 'mb_raz_cap', message0: 'remettre à zéro l\'angle de rotation', tooltip: 'Le cap actuel du robot devient 0°.' }),
        reporteur({ type: 'mb_secoue', message0: 'le CyberPi est secoué ?', tooltip: 'Vrai si le CyberPi vient d\'être secoué.' }, 'Boolean'),
        reporteur({ type: 'mb_chrono', message0: 'chronomètre (s)', tooltip: 'Temps écoulé en secondes depuis le démarrage ou la dernière remise à zéro.' }),
        instr({ type: 'mb_chrono_raz', message0: 'remettre le chronomètre à zéro', tooltip: 'Le chronomètre repart de 0.' }),
        reporteur({ type: 'mb_batterie', message0: 'niveau de la batterie (%)', tooltip: 'Charge restante de la batterie du mBot2, en %.' }),
    ]);
    // Blocs Blockly sans info-bulle francaise suffisante : texte d'aide pour mb_ligne.
    Blockly.Blocks['mb_ligne'].init = (function (init) {
        return function () { init.call(this); this.setTooltip('Vrai si ce capteur du quad RGB est au-dessus de la ligne (noire sur fond clair).'); };
    })(Blockly.Blocks['mb_ligne'].init);

    // Blocs « chapeau » : debut d'un programme. Un seul « quand le programme démarre ».
    // Forme arrondie posee dans init : la cle JSON « style: {hat} » de Blockly 10 n'agit que sur le PREMIER bloc cree
    // (jsonInit efface alors l'objet partage).
    const CHAPEAUX = ['mb_demarrage', 'mb_quand_bouton', 'mb_quand_recu'];
    for (const type of CHAPEAUX) {
        const init = Blockly.Blocks[type].init;
        Blockly.Blocks[type].init = function () { init.call(this); this.hat = 'cap'; };
    }

    // ==========================================
    // 2. GENERATEUR PYTHON (MicroPython du CyberPi)
    // ==========================================
    const I = () => P.INDENT;
    const v = (b, nom, defaut) => P.valueToCode(b, nom, P.ORDER_NONE) || (defaut === undefined ? '0' : defaut);
    const versTexte = (b, nom) => {
        const cible = b.getInputTargetBlock(nom);
        const code = v(b, nom, '""');
        return cible && (cible.type === 'text' || cible.type === 'text_join') ? code : 'str(' + code + ')';
    };
    const chaine = (t) => "'" + String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    const rvb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    // Moteur droit monte en miroir : on inverse son signe pour que « positif = avancer » sur les deux roues.
    const oppose = (code) => /^-?\d+(\.\d+)?$/.test(code) ? String(-Number(code)) : '-(' + code + ')';
    const signe = (port, code) => port === 'EM2' ? oppose(code) : code;

    /** Corps d'un chapeau : les blocs accroches dessous, avec les variables globales du programme. */
    function corpsChapeau(b) {
        const suite = b.getNextBlock();
        let corps = suite ? P.prefixLines(P.blockToCode(suite), I()) : '';
        const noms = b.workspace.getAllVariables().map(x => P.nameDB_.getName(x.getId(), Blockly.Names.NameType.VARIABLE));
        const globales = noms.length ? I() + 'global ' + noms.join(', ') + '\n' : '';
        return globales + (corps || I() + 'pass\n');
    }
    function chapeau(decorateur, base, b) {
        const nom = P.nameDB_.getDistinctName(base, Blockly.Names.NameType.PROCEDURE);
        return decorateur + '\ndef ' + nom + '():\n' + corpsChapeau(b) + '\n';
    }
    const F = P.forBlock;
    F['mb_demarrage'] = b => chapeau('@event.start', 'on_start', b);
    F['mb_quand_bouton'] = b => chapeau("@event.is_press('" + b.getFieldValue('BOUTON') + "')", 'on_press_' + b.getFieldValue('BOUTON'), b);
    F['mb_quand_recu'] = b => chapeau('@event.receive(' + chaine(b.getFieldValue('MSG')) + ')', 'on_receive', b);
    F['mb_diffuser'] = b => 'cyberpi.broadcast(' + chaine(b.getFieldValue('MSG')) + ')\n';

    F['mb_attendre'] = b => 'time.sleep(' + v(b, 'S') + ')\n';
    F['mb_attendre_jusqua'] = b => 'while not ' + v(b, 'COND', 'False') + ':\n' + I() + 'time.sleep(0.01)\n';
    F['mb_toujours'] = b => 'while True:\n' + (P.statementToCode(b, 'DO') || I() + 'pass\n');

    F['mb_avancer_pendant'] = b => 'mbot2.' + b.getFieldValue('SENS') + '(' + v(b, 'V') + ', ' + v(b, 'T') + ')\n';
    F['mb_tourner_pendant'] = b => 'mbot2.' + b.getFieldValue('SENS') + '(' + v(b, 'V') + ', ' + v(b, 'T') + ')\n';
    F['mb_mouvement'] = b => 'mbot2.' + b.getFieldValue('SENS') + '(' + v(b, 'V') + ')\n';
    F['mb_distance_cm'] = b => 'mbot2.straight(' + (b.getFieldValue('SENS') === '-1' ? oppose(v(b, 'D')) : v(b, 'D')) + ')\n';
    F['mb_tourner_angle'] = b => 'mbot2.turn(' + (b.getFieldValue('SENS') === '-1' ? oppose(v(b, 'A')) : v(b, 'A')) + ')\n';
    F['mb_puissance'] = b => 'mbot2.drive_power(' + v(b, 'G') + ', ' + oppose(v(b, 'D')) + ')\n';
    F['mb_vitesse_roues'] = b => 'mbot2.drive_speed(' + v(b, 'G') + ', ' + oppose(v(b, 'D')) + ')\n';
    F['mb_stop'] = () => 'mbot2.EM_stop("all")\n';

    F['mb_em_vitesse'] = b => 'mbot2.EM_set_speed(' + signe(b.getFieldValue('PORT'), v(b, 'V')) + ', "' + b.getFieldValue('PORT') + '")\n';
    F['mb_em_stop'] = b => 'mbot2.EM_stop("' + b.getFieldValue('PORT') + '")\n';
    F['mb_em_raz'] = b => 'mbot2.EM_reset_angle("' + b.getFieldValue('PORT') + '")\n';
    F['mb_em_angle'] = b => [signe(b.getFieldValue('PORT'), 'mbot2.EM_get_angle("' + b.getFieldValue('PORT') + '")'), P.ORDER_UNARY_SIGN];
    F['mb_em_vitesse_lue'] = b => [signe(b.getFieldValue('PORT'), 'mbot2.EM_get_speed("' + b.getFieldValue('PORT') + '")'), P.ORDER_UNARY_SIGN];

    F['mb_distance'] = () => ['mbuild.ultrasonic2.get(1)', P.ORDER_FUNCTION_CALL];
    F['mb_ligne'] = b => ['mbuild.quad_rgb_sensor.is_line("' + b.getFieldValue('CAPTEUR') + '", 1)', P.ORDER_FUNCTION_CALL];
    F['mb_ecart_ligne'] = () => ['mbuild.quad_rgb_sensor.get_offset_track(1)', P.ORDER_FUNCTION_CALL];
    F['mb_gris'] = b => ['mbuild.quad_rgb_sensor.get_gray("' + b.getFieldValue('CAPTEUR') + '", 1)', P.ORDER_FUNCTION_CALL];
    F['mb_couleur_est'] = b => ['mbuild.quad_rgb_sensor.is_color("' + b.getFieldValue('COULEUR') + '", "' + b.getFieldValue('CAPTEUR') + '", 1)', P.ORDER_FUNCTION_CALL];

    F['mb_ecran_ligne'] = b => 'cyberpi.console.println(' + versTexte(b, 'TEXTE') + ')\n';
    F['mb_ecran_ecrire'] = b => 'cyberpi.console.print(' + versTexte(b, 'TEXTE') + ')\n';
    F['mb_ecran_label'] = b => {
        // index : un emplacement par position, pour qu'un texte ne remplace que celui affiche au meme endroit.
        const index = POSITIONS.findIndex(p => p[1] === b.getFieldValue('POS'));
        return 'cyberpi.display.show_label(' + versTexte(b, 'TEXTE') + ', ' + b.getFieldValue('TAILLE') + ', "' + b.getFieldValue('POS') + '", index=' + index + ')\n';
    };
    F['mb_ecran_couleur'] = b => 'cyberpi.display.set_brush(' + rvb(b.getFieldValue('COULEUR')).join(', ') + ')\n';
    F['mb_ecran_effacer'] = () => 'cyberpi.display.clear()\n';
    F['mb_print'] = b => 'print(' + versTexte(b, 'TEXTE') + ')\n';

    const idLed = (b) => b.getFieldValue('LED') === 'all' ? '"all"' : b.getFieldValue('LED');
    F['mb_led_couleur'] = b => 'cyberpi.led.on(' + rvb(b.getFieldValue('COULEUR')).join(', ') + ', ' + idLed(b) + ')\n';
    F['mb_led_rvb'] = b => 'cyberpi.led.on(' + v(b, 'R') + ', ' + v(b, 'V') + ', ' + v(b, 'B') + ', ' + idLed(b) + ')\n';
    F['mb_led_eteindre'] = b => 'cyberpi.led.off(' + idLed(b) + ')\n';
    F['mb_led_animation'] = b => "cyberpi.led.play('" + b.getFieldValue('ANIM') + "')\n";
    F['mb_led_luminosite'] = b => 'cyberpi.led.set_bri(' + v(b, 'L') + ')\n';

    F['mb_son_note'] = b => 'cyberpi.audio.play_music(' + b.getFieldValue('NOTE') + ', ' + b.getFieldValue('DUREE') + ')\n';
    F['mb_son_frequence'] = b => 'cyberpi.audio.play_tone(' + v(b, 'F') + ', ' + v(b, 'T') + ')\n';
    F['mb_son_jouer'] = b => "cyberpi.audio.play_until('" + b.getFieldValue('SON') + "')\n";
    F['mb_son_volume'] = b => 'cyberpi.audio.set_vol(' + v(b, 'V') + ')\n';
    F['mb_son_stop'] = () => 'cyberpi.audio.stop()\n';

    F['mb_bouton'] = b => ["cyberpi.controller.is_press('" + b.getFieldValue('BOUTON') + "')", P.ORDER_FUNCTION_CALL];
    F['mb_luminosite'] = () => ['cyberpi.get_bri()', P.ORDER_FUNCTION_CALL];
    F['mb_bruit'] = () => ['cyberpi.get_loudness("maximum")', P.ORDER_FUNCTION_CALL];
    F['mb_inclinaison'] = b => ['cyberpi.get_' + b.getFieldValue('AXE') + '()', P.ORDER_FUNCTION_CALL];
    F['mb_raz_cap'] = () => 'cyberpi.reset_yaw()\n';
    F['mb_secoue'] = () => ['cyberpi.is_shake()', P.ORDER_FUNCTION_CALL];
    F['mb_chrono'] = () => ['cyberpi.timer.get()', P.ORDER_FUNCTION_CALL];
    F['mb_chrono_raz'] = () => 'cyberpi.timer.reset()\n';
    F['mb_batterie'] = () => ['cyberpi.get_battery()', P.ORDER_FUNCTION_CALL];

    // « ajouter … à la variable » : la version de Blockly importe le module numbers, absent de MicroPython.
    F['math_change'] = b => P.nameDB_.getName(b.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE) + ' += ' + v(b, 'DELTA') + '\n';

    /**
     * Programme Python complet, au format attendu par le CyberPi en mode televersement : seuls les chapeaux
     * (evenements) et les fonctions comptent ; un bloc pose seul n'est jamais execute (il est grise, voir app.js).
     */
    function genererPython(ws) {
        P.init(ws);
        // Variables a 0 plutot que None : « ajouter 1 a compteur » marche sans « mettre compteur a 0 » prealable.
        if (P.definitions_['variables']) P.definitions_['variables'] = P.definitions_['variables'].replace(/ = None$/gm, ' = 0');
        const morceaux = [];
        for (const b of ws.getTopBlocks(true)) {
            if (!b.isEnabled()) continue;
            if (CHAPEAUX.includes(b.type)) morceaux.push(P.blockToCode(b, true));
            else if (b.type.startsWith('procedures_def')) P.blockToCode(b, true);   // la fonction va dans definitions_
        }
        P.definitions_['import_mbot2'] = 'import event, time, cyberpi, mbot2, mbuild';
        let code = P.finish(morceaux.join('\n'));
        code = code.replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '');
        return '# Programme créé avec l\'éditeur mBot2 (Technologie Services)\n' + code.replace(/\s+$/, '') + '\n';
    }

    // ==========================================
    // 3. GENERATEUR « SIMU » (JavaScript asynchrone pour le simulateur)
    // ==========================================
    // Tout le code s'execute dans des fonctions async : chaque action du robot est attendue (await R.xxx()),
    // chaque tour de boucle cede la main (await R.pas()) pour que l'affichage et les autres evenements avancent.
    // Les variables vivent dans V (V["nom"]) et les fonctions dans FN : aucun nom d'eleve ne devient un identifiant JS.
    // Toutes les valeurs sont entre parentheses : l'ordre de priorite n'a jamais a etre calcule (ordre 0).
    const S = new Blockly.Generator('SIMU');
    S.INDENT = '  ';
    S.scrub_ = function (b, code, seul) {
        const suite = b.nextConnection && b.nextConnection.targetBlock();
        return code + (suite && !seul ? S.blockToCode(suite) : '');
    };
    const sv = (b, nom, defaut) => S.valueToCode(b, nom, 0) || (defaut === undefined ? '0' : defaut);
    const st = (b, nom) => S.statementToCode(b, nom);
    const nomVar = (b, champ) => JSON.stringify(b.getField(champ || 'VAR').getVariable().name);
    const r = (code) => ['(' + code + ')', 0];
    let compteur = 0;
    const G = S.forBlock;

    // --- chapeaux ---
    function chapeauSimu(evenement, cle, b) {
        const suite = b.getNextBlock();
        return 'R.sur(' + JSON.stringify(evenement) + ', ' + JSON.stringify(cle) + ', async () => {\n' + (suite ? S.prefixLines(S.blockToCode(suite), S.INDENT) : '') + '});\n';
    }
    G['mb_demarrage'] = b => chapeauSimu('start', '', b);
    G['mb_quand_bouton'] = b => chapeauSimu('bouton', b.getFieldValue('BOUTON'), b);
    G['mb_quand_recu'] = b => chapeauSimu('message', b.getFieldValue('MSG'), b);
    G['mb_diffuser'] = b => 'R.diffuser(' + JSON.stringify(b.getFieldValue('MSG')) + ');\n';

    G['mb_attendre'] = b => 'await R.attendre(' + sv(b, 'S') + ');\n';
    G['mb_attendre_jusqua'] = b => 'while (!' + sv(b, 'COND', 'false') + ') await R.pas();\n';
    G['mb_toujours'] = b => 'while (true) {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';

    G['mb_avancer_pendant'] = b => 'await R.mbot2(' + JSON.stringify(b.getFieldValue('SENS')) + ', ' + sv(b, 'V') + ', ' + sv(b, 'T') + ');\n';
    G['mb_tourner_pendant'] = G['mb_avancer_pendant'];
    G['mb_mouvement'] = b => 'await R.mbot2(' + JSON.stringify(b.getFieldValue('SENS')) + ', ' + sv(b, 'V') + ', null);\n';
    G['mb_distance_cm'] = b => 'await R.droit(' + b.getFieldValue('SENS') + ' * ' + sv(b, 'D') + ');\n';
    G['mb_tourner_angle'] = b => 'await R.tourner(' + b.getFieldValue('SENS') + ' * ' + sv(b, 'A') + ');\n';
    G['mb_puissance'] = b => 'R.puissance(' + sv(b, 'G') + ', ' + sv(b, 'D') + ');\n';
    G['mb_vitesse_roues'] = b => 'R.vitesses(' + sv(b, 'G') + ', ' + sv(b, 'D') + ');\n';
    G['mb_stop'] = () => 'R.stop("all");\n';

    G['mb_em_vitesse'] = b => 'R.vitesseMoteur("' + b.getFieldValue('PORT') + '", ' + sv(b, 'V') + ');\n';
    G['mb_em_stop'] = b => 'R.stop("' + b.getFieldValue('PORT') + '");\n';
    G['mb_em_raz'] = b => 'R.razAngle("' + b.getFieldValue('PORT') + '");\n';
    G['mb_em_angle'] = b => r('R.angleMoteur("' + b.getFieldValue('PORT') + '")');
    G['mb_em_vitesse_lue'] = b => r('R.vitesseLue("' + b.getFieldValue('PORT') + '")');

    G['mb_distance'] = () => r('R.distance()');
    G['mb_ligne'] = b => r('R.ligne("' + b.getFieldValue('CAPTEUR') + '")');
    G['mb_ecart_ligne'] = () => r('R.ecartLigne()');
    G['mb_gris'] = b => r('R.gris("' + b.getFieldValue('CAPTEUR') + '")');
    G['mb_couleur_est'] = b => r('R.couleurSol("' + b.getFieldValue('CAPTEUR') + '") === "' + b.getFieldValue('COULEUR') + '"');

    G['mb_ecran_ligne'] = b => 'R.ecran.ligne(R.texte(' + sv(b, 'TEXTE', '""') + '));\n';
    G['mb_ecran_ecrire'] = b => 'R.ecran.ecrire(R.texte(' + sv(b, 'TEXTE', '""') + '));\n';
    G['mb_ecran_label'] = b => 'R.ecran.label(R.texte(' + sv(b, 'TEXTE', '""') + '), ' + b.getFieldValue('TAILLE') + ', "' + b.getFieldValue('POS') + '");\n';
    G['mb_ecran_couleur'] = b => 'R.ecran.pinceau("' + b.getFieldValue('COULEUR') + '");\n';
    G['mb_ecran_effacer'] = () => 'R.ecran.effacer();\n';
    G['mb_print'] = b => 'R.print(R.texte(' + sv(b, 'TEXTE', '""') + '));\n';

    G['mb_led_couleur'] = b => 'R.led("' + b.getFieldValue('LED') + '", ' + rvb(b.getFieldValue('COULEUR')).join(', ') + ');\n';
    G['mb_led_rvb'] = b => 'R.led("' + b.getFieldValue('LED') + '", ' + sv(b, 'R') + ', ' + sv(b, 'V') + ', ' + sv(b, 'B') + ');\n';
    G['mb_led_eteindre'] = b => 'R.led("' + b.getFieldValue('LED') + '", 0, 0, 0);\n';
    G['mb_led_animation'] = b => 'await R.animation("' + b.getFieldValue('ANIM') + '");\n';
    G['mb_led_luminosite'] = b => 'R.luminositeLed(' + sv(b, 'L') + ');\n';

    G['mb_son_note'] = b => 'await R.note(' + b.getFieldValue('NOTE') + ', ' + b.getFieldValue('DUREE') + ');\n';
    G['mb_son_frequence'] = b => 'await R.son(' + sv(b, 'F') + ', ' + sv(b, 'T') + ');\n';
    G['mb_son_jouer'] = b => 'await R.sonEnregistre("' + b.getFieldValue('SON') + '");\n';
    G['mb_son_volume'] = b => 'R.volume(' + sv(b, 'V') + ');\n';
    G['mb_son_stop'] = () => 'R.arreterSon();\n';

    G['mb_bouton'] = b => r('R.bouton("' + b.getFieldValue('BOUTON') + '")');
    G['mb_luminosite'] = () => r('R.capteur("lumiere")');
    G['mb_bruit'] = () => r('R.capteur("bruit")');
    G['mb_inclinaison'] = b => r('R.inclinaison("' + b.getFieldValue('AXE') + '")');
    G['mb_raz_cap'] = () => 'R.razCap();\n';
    G['mb_secoue'] = () => r('R.secoue()');
    G['mb_chrono'] = () => r('R.chrono()');
    G['mb_chrono_raz'] = () => 'R.razChrono();\n';
    G['mb_batterie'] = () => r('R.capteur("batterie")');

    // --- blocs standard de Blockly ---
    G['controls_if'] = b => {
        let code = '', n = 0;
        do {
            code += (n ? ' else ' : '') + 'if (R.vrai(' + sv(b, 'IF' + n, 'false') + ')) {\n' + st(b, 'DO' + n) + '}';
            n++;
        } while (b.getInput('IF' + n));
        if (b.getInput('ELSE')) code += ' else {\n' + st(b, 'ELSE') + '}';
        return code + '\n';
    };
    G['controls_repeat_ext'] = b => {
        const i = '_i' + (++compteur), n = '_n' + compteur;
        return 'for (let ' + i + ' = 0, ' + n + ' = Number(' + sv(b, 'TIMES') + '); ' + i + ' < ' + n + '; ' + i + '++) {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    };
    G['controls_repeat'] = b => 'for (let _r = 0; _r < ' + Number(b.getFieldValue('TIMES')) + '; _r++) {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    G['controls_whileUntil'] = b => {
        const cond = sv(b, 'BOOL', 'false');
        return 'while (' + (b.getFieldValue('MODE') === 'UNTIL' ? '!R.vrai(' + cond + ')' : 'R.vrai(' + cond + ')') + ') {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    };
    G['controls_for'] = b => {
        const x = 'V[' + nomVar(b) + ']', k = ++compteur;
        // Comme en Python (range de Blockly) : bornes comprises, pas toujours positif, sens donne par les bornes.
        return 'for (let _de' + k + ' = Number(' + sv(b, 'FROM') + '), _a' + k + ' = Number(' + sv(b, 'TO') + '), _p' + k + ' = Math.abs(Number(' + sv(b, 'BY', '1') + ')) || 1, ' +
            '_s' + k + ' = _de' + k + ' <= _a' + k + ' ? 1 : -1, ' + x + ' = _de' + k + '; _s' + k + ' > 0 ? ' + x + ' <= _a' + k + ' : ' + x + ' >= _a' + k + '; ' +
            x + ' += _s' + k + ' * _p' + k + ') {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    };
    G['controls_forEach'] = b => 'for (const _e of ' + sv(b, 'LIST', '[]') + ') {\n' + S.INDENT + 'V[' + nomVar(b) + '] = _e;\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    G['controls_flow_statements'] = b => (b.getFieldValue('FLOW') === 'BREAK' ? 'break' : 'continue') + ';\n';

    const COMPARE = { EQ: '===', NEQ: '!==', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    G['logic_compare'] = b => r(sv(b, 'A') + ' ' + COMPARE[b.getFieldValue('OP')] + ' ' + sv(b, 'B'));
    G['logic_operation'] = b => r('R.vrai(' + sv(b, 'A', 'false') + ') ' + (b.getFieldValue('OP') === 'AND' ? '&&' : '||') + ' R.vrai(' + sv(b, 'B', 'false') + ')');
    G['logic_negate'] = b => r('!R.vrai(' + sv(b, 'BOOL', 'false') + ')');
    G['logic_boolean'] = b => r(b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false');
    G['logic_ternary'] = b => r('R.vrai(' + sv(b, 'IF', 'false') + ') ? ' + sv(b, 'THEN', 'null') + ' : ' + sv(b, 'ELSE', 'null'));

    G['math_number'] = b => r(String(Number(b.getFieldValue('NUM'))));
    const ARITH = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' };
    G['math_arithmetic'] = b => r(sv(b, 'A') + ' ' + ARITH[b.getFieldValue('OP')] + ' ' + sv(b, 'B'));
    const SIMPLE = { ROOT: 'Math.sqrt(x)', ABS: 'Math.abs(x)', NEG: '-(x)', LN: 'Math.log(x)', LOG10: 'Math.log10(x)', EXP: 'Math.exp(x)', POW10: '10 ** (x)',
                     SIN: 'Math.sin((x) / 180 * Math.PI)', COS: 'Math.cos((x) / 180 * Math.PI)', TAN: 'Math.tan((x) / 180 * Math.PI)' };
    G['math_single'] = b => r(SIMPLE[b.getFieldValue('OP')].replace('x', sv(b, 'NUM')));
    G['math_trig'] = G['math_single'];
    G['math_round'] = b => r({ ROUND: 'Math.round', ROUNDUP: 'Math.ceil', ROUNDDOWN: 'Math.floor' }[b.getFieldValue('OP')] + '(' + sv(b, 'NUM') + ')');
    G['math_modulo'] = b => r('R.modulo(' + sv(b, 'DIVIDEND') + ', ' + sv(b, 'DIVISOR', '1') + ')');
    G['math_random_int'] = b => r('R.hasard(' + sv(b, 'FROM') + ', ' + sv(b, 'TO') + ')');
    G['math_constrain'] = b => r('Math.min(Math.max(' + sv(b, 'VALUE') + ', ' + sv(b, 'LOW') + '), ' + sv(b, 'HIGH') + ')');

    G['text'] = b => r(JSON.stringify(b.getFieldValue('TEXT')));
    G['text_join'] = b => {
        const parties = [];
        for (let i = 0; b.getInput('ADD' + i); i++) parties.push('R.texte(' + sv(b, 'ADD' + i, '""') + ')');
        return r(parties.length ? parties.join(' + ') : '""');
    };
    G['text_length'] = b => r('R.texte(' + sv(b, 'VALUE', '""') + ').length');

    G['variables_get'] = b => r('V[' + nomVar(b) + ']');
    G['variables_set'] = b => 'V[' + nomVar(b) + '] = ' + sv(b, 'VALUE') + ';\n';
    G['math_change'] = b => 'V[' + nomVar(b) + '] = Number(V[' + nomVar(b) + ']) + Number(' + sv(b, 'DELTA') + ');\n';

    G['lists_create_with'] = b => {
        const elements = [];
        for (let i = 0; i < b.itemCount_; i++) elements.push(sv(b, 'ADD' + i, 'null'));
        return r('[' + elements.join(', ') + ']');
    };
    G['lists_length'] = b => r(sv(b, 'VALUE', '[]') + '.length');
    G['lists_getIndex'] = b => {
        const appel = 'R.listeLire(' + sv(b, 'VALUE', '[]') + ', "' + b.getFieldValue('MODE') + '", "' + b.getFieldValue('WHERE') + '", ' + sv(b, 'AT', '1') + ')';
        return b.outputConnection ? r(appel) : appel + ';\n';
    };
    G['lists_setIndex'] = b => 'R.listeEcrire(' + sv(b, 'LIST', '[]') + ', "' + b.getFieldValue('MODE') + '", "' + b.getFieldValue('WHERE') + '", ' + sv(b, 'AT', '1') + ', ' + sv(b, 'TO', 'null') + ');\n';

    // Fonctions : les parametres sont des variables (comme dans Blockly) sauvegardees puis restaurees a chaque appel.
    function definitionSimu(b, avecRetour) {
        const nom = JSON.stringify(b.getFieldValue('NAME'));
        const params = (b.getVars ? b.getVars() : []).map(p => JSON.stringify(p));
        const retour = avecRetour ? S.INDENT + S.INDENT + 'return ' + sv(b, 'RETURN', 'null') + ';\n' : '';
        return 'FN[' + nom + '] = async (...args) => {\n' +
            S.INDENT + 'const _avant = [' + params.join(', ') + '].map(p => V[p]);\n' +
            S.INDENT + '[' + params.join(', ') + '].forEach((p, i) => { V[p] = args[i]; });\n' +
            S.INDENT + 'try {\n' + S.prefixLines(st(b, 'STACK'), S.INDENT) + retour + S.INDENT + '} finally {\n' +
            S.INDENT + S.INDENT + '[' + params.join(', ') + '].forEach((p, i) => { V[p] = _avant[i]; });\n' + S.INDENT + '}\n};\n';
    }
    G['procedures_defnoreturn'] = b => definitionSimu(b, false);
    G['procedures_defreturn'] = b => definitionSimu(b, true);
    const appelSimu = b => {
        const args = (b.getVars ? b.getVars() : []).map((_, i) => sv(b, 'ARG' + i, 'null'));
        return 'await FN[' + JSON.stringify(b.getFieldValue('NAME')) + '](' + args.join(', ') + ')';
    };
    G['procedures_callnoreturn'] = b => appelSimu(b) + ';\n';
    G['procedures_callreturn'] = b => r(appelSimu(b));
    G['procedures_ifreturn'] = b => 'if (R.vrai(' + sv(b, 'CONDITION', 'false') + ')) return' + (b.hasReturnValue_ ? ' ' + sv(b, 'VALUE', 'null') : '') + ';\n';

    /** Programme du simulateur : fonctions d'abord (les chapeaux peuvent les appeler des le demarrage), puis chapeaux. */
    function genererSimu(ws) {
        S.init(ws);
        compteur = 0;
        const fonctions = [], chapeaux = [];
        for (const b of ws.getTopBlocks(true)) {
            if (!b.isEnabled()) continue;
            if (CHAPEAUX.includes(b.type)) chapeaux.push(S.blockToCode(b, true));
            else if (b.type.startsWith('procedures_def')) fonctions.push(S.blockToCode(b, true));
        }
        return fonctions.join('') + chapeaux.join('');
    }

    window.BLOCS_MBOT2 = { CHAPEAUX, genererPython, genererSimu, POSITIONS };
})();
