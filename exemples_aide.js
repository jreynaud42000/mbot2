// exemples_aide.js — un petit programme d'exemple pour chaque bloc de la boite a outils (blocs mBot2 et blocs
// generaux : controle, logique, maths, texte, variables, listes, fonctions), montre dans « Aide sur ce bloc » (app.js) :
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

        // ----- Blocs generaux (Controle, Logique, Maths, Texte, Variables, Listes, Fonctions) -----
        { types: ['controls_repeat_ext'], titre: 'Clignoter 5 fois',
          texte: 'Le bloc « répéter » refait 5 fois : allumer en rouge, attendre, éteindre, attendre.',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(5), DO: { block: pile(led('#ff0000'), attendre(0.3), eteindre(), attendre(0.3)) } }))] },
        { types: ['controls_whileUntil'], titre: 'Avancer tant que la voie est libre',
          texte: 'Tant que l\'obstacle est à plus de 20 cm, le robot avance ; dès qu\'il est plus près, la boucle s\'arrête et le robot aussi.',
          blocs: [demarrage(B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: { block: compare(B('mb_distance'), 'GT', 20) },
                    DO: { block: B('mb_mouvement', { SENS: 'forward' }, { V: n(40) }) } }), stop())] },
        { types: ['controls_for'], titre: 'Compter de 1 à 10',
          texte: 'La variable i prend les valeurs 1, 2, 3… jusqu\'à 10 ; chaque valeur s\'affiche une demi-seconde.',
          blocs: [demarrage(B('controls_for', { VAR: { name: 'i' } }, { FROM: n(1), TO: n(10), BY: n(1),
                    DO: { block: pile(ligneBloc(B('variables_get', { VAR: { name: 'i' } })), attendre(0.5)) } }))] },
        { types: ['controls_flow_statements'], titre: 'Sortir d\'une boucle',
          texte: 'Le robot compte jusqu\'à 10, mais « sortir de la boucle » l\'arrête dès que i dépasse 5.',
          blocs: [demarrage(B('controls_for', { VAR: { name: 'i' } }, { FROM: n(1), TO: n(10), BY: n(1), DO: { block: pile(
                    si(compare(B('variables_get', { VAR: { name: 'i' } }), 'GT', 5), B('controls_flow_statements', { FLOW: 'BREAK' })),
                    ligneBloc(B('variables_get', { VAR: { name: 'i' } }))) } }))] },
        { types: ['controls_if', 'logic_compare'], titre: 'Freiner devant un obstacle',
          texte: 'Si l\'obstacle est à moins de 20 cm, le robot s\'arrête ; sinon, il avance.',
          blocs: [demarrage(toujours(si(compare(B('mb_distance'), 'LT', 20), stop(), B('mb_mouvement', { SENS: 'forward' }, { V: n(40) }))))] },
        { types: ['logic_operation'], titre: 'Deux boutons à la fois',
          texte: 'Les LED ne s\'allument que si A ET B sont appuyés en même temps.',
          blocs: [demarrage(toujours(si(B('logic_operation', { OP: 'AND' }, { A: val('mb_bouton', { BOUTON: 'a' }), B: val('mb_bouton', { BOUTON: 'b' }) }),
                    led('#00ff00'), eteindre())))] },
        { types: ['logic_negate'], titre: 'Clignoter en attendant',
          texte: 'Tant que le bouton A n\'est PAS appuyé, les LED clignotent ; un appui sur A arrête le clignotement.',
          blocs: [demarrage(B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: { block: B('logic_negate', null, { BOOL: val('mb_bouton', { BOUTON: 'a' }) }) },
                    DO: { block: pile(led('#ffaa00'), attendre(0.2), eteindre(), attendre(0.2)) } }), ligne('Parti !'))] },
        { types: ['logic_boolean'], titre: 'Un interrupteur',
          texte: 'La variable « en_marche » vaut vrai au départ : le robot avance. Le bouton B la met à faux : il s\'arrête.',
          blocs: [demarrage(B('variables_set', { VAR: { name: 'en_marche' } }, { VALUE: val('logic_boolean', { BOOL: 'TRUE' }) }),
                            toujours(si(B('variables_get', { VAR: { name: 'en_marche' } }), B('mb_mouvement', { SENS: 'forward' }, { V: n(40) }), stop()))),
                  quandBouton('b', B('variables_set', { VAR: { name: 'en_marche' } }, { VALUE: val('logic_boolean', { BOOL: 'FALSE' }) }))] },

        { types: ['math_number', 'math_arithmetic'], titre: 'Calculer une distance',
          texte: 'Le robot calcule 3 × 20 = 60 et l\'affiche, puis avance de 10 + 20 = 30 cm.',
          blocs: [demarrage(ligneBloc(B('math_arithmetic', { OP: 'MULTIPLY' }, { A: n(3), B: n(20) })),
                            B('mb_distance_cm', { SENS: '1' }, { D: { block: B('math_arithmetic', { OP: 'ADD' }, { A: n(10), B: n(20) }) } }))] },
        { types: ['math_random_int'], titre: 'Promenade au hasard',
          texte: 'Quatre fois : le robot tourne d\'un angle tiré au hasard entre 30° et 180°, puis avance de 15 cm.',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(4), DO: { block: pile(
                    B('mb_tourner_angle', { SENS: '1' }, { A: { block: B('math_random_int', null, { FROM: n(30), TO: n(180) }) } }),
                    B('mb_distance_cm', { SENS: '1' }, { D: n(15) })) } }))] },
        { types: ['math_round'], titre: 'Arrondir une mesure',
          texte: 'La distance est arrondie au centimètre près avant d\'être affichée.',
          blocs: [demarrage(toujours(label(B('math_round', { OP: 'ROUND' }, { NUM: { block: B('mb_distance') } })), attendre(0.2)))] },
        { types: ['math_single'], titre: 'Écart sans signe',
          texte: '« valeur absolue » enlève le signe : l\'écran montre de combien le robot est décalé, à gauche comme à droite.',
          blocs: [demarrage(toujours(label(B('math_single', { OP: 'ABS' }, { NUM: { block: B('mb_ecart_ligne') } })), attendre(0.2)))] },
        { types: ['math_modulo'], titre: 'Pair ou impair',
          texte: 'Pour i de 1 à 6 : si le reste de i ÷ 2 vaut 0 (nombre pair), les LED sont vertes, sinon rouges.',
          blocs: [demarrage(B('controls_for', { VAR: { name: 'i' } }, { FROM: n(1), TO: n(6), BY: n(1), DO: { block: pile(
                    si(B('logic_compare', { OP: 'EQ' }, { A: { block: B('math_modulo', null, { DIVIDEND: { block: B('variables_get', { VAR: { name: 'i' } }) }, DIVISOR: n(2) }) }, B: n(0) }),
                       led('#00ff00'), led('#ff0000')),
                    attendre(0.5)) } }))] },
        { types: ['math_constrain'], titre: 'Ralentir près d\'un obstacle',
          texte: 'La vitesse vaut la distance mesurée, mais elle reste entre 0 et 100 tr/min : le robot ralentit en approchant d\'un mur.',
          blocs: [demarrage(toujours(
                    B('variables_set', { VAR: { name: 'vitesse' } }, { VALUE: { block: B('math_constrain', null, { VALUE: { block: B('mb_distance') }, LOW: n(0), HIGH: n(100) }) } }),
                    B('mb_vitesse_roues', null, { G: val('variables_get', { VAR: { name: 'vitesse' } }), D: val('variables_get', { VAR: { name: 'vitesse' } }) })))] },

        { types: ['text', 'text_join'], titre: 'Un message composé',
          texte: '« créer un texte avec » colle des morceaux : un texte, la distance mesurée, puis l\'unité.',
          blocs: [demarrage(toujours(ligneBloc(B('text_join', null, { ADD0: t('Distance : '), ADD1: val('mb_distance'), ADD2: t(' cm') },
                    { extraState: { itemCount: 3 }, inline: true })), attendre(1)))] },
        { types: ['text_length'], titre: 'Compter les lettres',
          texte: 'L\'écran affiche le nombre de lettres du mot « mBot2 » : 5.',
          blocs: [demarrage(ligneBloc(joindre('Lettres : ', B('text_length', null, { VALUE: t('mBot2') }))))] },

        { types: ['variables_set', 'variables_get', 'math_change'], titre: 'Compter les appuis',
          texte: 'La variable « compteur » part de 0 ; chaque appui sur A lui ajoute 1, et l\'écran affiche sa valeur.',
          blocs: [demarrage(B('variables_set', { VAR: { name: 'compteur' } }, { VALUE: n(0) }), label(B('variables_get', { VAR: { name: 'compteur' } }))),
                  quandBouton('a', B('math_change', { VAR: { name: 'compteur' } }, { DELTA: n(1) }), label(B('variables_get', { VAR: { name: 'compteur' } })))] },

        { types: ['lists_create_with', 'controls_forEach'], titre: 'Jouer une mélodie',
          texte: 'La liste contient 4 fréquences (do, mi, sol, do aigu) ; « pour chaque élément » les joue l\'une après l\'autre.',
          blocs: [demarrage(B('controls_forEach', { VAR: { name: 'frequence' } }, {
                    LIST: { block: B('lists_create_with', null, { ADD0: n(262), ADD1: n(330), ADD2: n(392), ADD3: n(523) }, { extraState: { itemCount: 4 }, inline: true }) },
                    DO: { block: B('mb_son_frequence', null, { F: val('variables_get', { VAR: { name: 'frequence' } }), T: n(0.3) }) } }))] },
        { types: ['lists_length', 'lists_getIndex', 'lists_setIndex'], titre: 'Mémoriser des mesures',
          texte: 'La liste « mesures » a 3 cases ; la distance est rangée dans la case n° 1, puis l\'écran affiche cette case et la taille de la liste.',
          blocs: [demarrage(
                    B('variables_set', { VAR: { name: 'mesures' } }, { VALUE: { block: B('lists_create_with', null, { ADD0: n(0), ADD1: n(0), ADD2: n(0) }, { extraState: { itemCount: 3 }, inline: true }) } }),
                    B('lists_setIndex', { MODE: 'SET', WHERE: 'FROM_START' }, { LIST: val('variables_get', { VAR: { name: 'mesures' } }), AT: n(1), TO: val('mb_distance') }),
                    ligneBloc(joindre('Case 1 : ', B('lists_getIndex', { MODE: 'GET', WHERE: 'FROM_START' }, { VALUE: val('variables_get', { VAR: { name: 'mesures' } }), AT: n(1) }))),
                    ligneBloc(joindre('Taille : ', B('lists_length', null, { VALUE: val('variables_get', { VAR: { name: 'mesures' } }) }))))] },

        { types: ['procedures_defnoreturn', 'procedures_callnoreturn'], titre: 'Une fonction « clignoter »',
          texte: 'La fonction « clignoter » regroupe 4 blocs ; le programme l\'appelle 3 fois au lieu de recopier les blocs.',
          blocs: [B('procedures_defnoreturn', { NAME: 'clignoter' }, { STACK: { block: pile(led('#ff0000'), attendre(0.2), eteindre(), attendre(0.2)) } }),
                  demarrage(B('controls_repeat_ext', null, { TIMES: n(3), DO: { block: B('procedures_callnoreturn', null, null, { extraState: { name: 'clignoter' } }) } }))] },
        { types: ['procedures_defreturn', 'procedures_callreturn', 'procedures_ifreturn'], titre: 'Une fonction qui renvoie un résultat',
          texte: 'La fonction « comparer » reçoit une distance x : si x est inférieure à 20, elle renvoie « près », sinon « loin ». L\'écran affiche le résultat.',
          blocs: [B('procedures_defreturn', { NAME: 'comparer' }, {
                      STACK: { block: B('procedures_ifreturn', null, { CONDITION: { block: compare(B('variables_get', { VAR: { name: 'x' } }), 'LT', 20) }, VALUE: t('près') },
                                        { extraState: '<mutation value="1"></mutation>' }) },
                      RETURN: t('loin') }, { extraState: { params: [{ name: 'x' }] } }),
                  demarrage(toujours(label(B('procedures_callreturn', null, { ARG0: val('mb_distance') }, { extraState: { name: 'comparer', params: ['x'] } })), attendre(0.2)))] },
    ];

    const parType = {};
    for (const ex of EXEMPLES) for (const type of ex.types) parType[type] = ex;
    window.EXEMPLES_AIDE_MBOT2 = parType;
})();
