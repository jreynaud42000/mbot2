# Éditeur mBot2 (Technologie Services)

Éditeur de programmation par blocs, en français, pour le robot **mBot2 de Makeblock** (carte CyberPi, MicroPython).
Ergonomie des éditeurs micro:bit (`easybloc_ts_mode_classe`) : bandeau orange, thèmes clair / sombre / contraste élevé /
saisons, blocs de la couleur de la puce de leur catégorie, titres de groupe avec trait de séparation, console, visite guidée.

## Lancer

- Double-cliquer sur `lancer_projet.bat` (ou `python app.py`) : l'éditeur s'ouvre sur http://localhost:8020.
- Pour envoyer un programme au robot : **Chrome ou Edge** (Web Serial). Fermer mBlock et mLink avant.
- Aucune dépendance Python (bibliothèque standard) ; Blockly 10.4.3 est embarqué dans `lib/blockly` (aucun CDN).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page, styles (thèmes repris des éditeurs micro:bit), bandeau, panneaux, fenêtres |
| `blocs.js` | blocs mBot2, générateur Python (format mBlock « téléversement »), générateur « SIMU » pour le simulateur |
| `app.js` | espace Blockly, boîte à outils et couleurs, thèmes Blockly, code Python, fichiers, exemples, aide, console |
| `simulateur.js` | robot 2D sur piste à l'échelle (200 × 150 cm), capteurs, écran 128 × 128, LED, son, boutons |
| `images/mbot2_dessus.png` | photo du mBot2 vu de dessus (fond transparent), dessinée par le simulateur à l'échelle des roues |
| `exemples_aide.js` | un programme d'exemple par bloc, montré dans « Aide sur ce bloc » avec le bouton « Insérer l'exemple » |
| `televersement.js` | envoi du programme dans le CyberPi par USB (protocole F3…F4 de mBlock) et console du robot |
| `bandeau.js` | thème, contraste, saisons et décors, puces, recherche de blocs (repris de `easybloc_ts_mode_classe`) |
| `tuto.js` | visite guidée (moteur repris de `easybloc_ts_mode_classe`, étapes mBot2) |
| `app.py`, `lancer_projet.bat` | petit serveur local sans cache |

## Programme généré

```python
# Programme créé avec l'éditeur mBot2 (Technologie Services)
import event, time, cyberpi, mbot2, mbuild

@event.start
def on_start():
    cyberpi.console.println('Je trace un carré')
    for count in range(4):
        mbot2.straight(30)
        mbot2.turn(90)
```

- Seuls les blocs placés sous un événement (« quand le programme démarre », « quand le bouton … est pressé »,
  « quand je reçois … ») ou dans une fonction s'exécutent ; un bloc posé seul est grisé.
- Sur tous les blocs, une vitesse positive fait **avancer** la roue. Le moteur droit (EM2) étant monté en miroir,
  le générateur inverse son signe : `mbot2.drive_speed(50, -50)` = avancer (documentation Makeblock).
- « Enregistrer » produit un vrai fichier `.py` ; les blocs y sont ajoutés en dernière ligne (commentaire
  `# blocs-mbot2:`) pour pouvoir le rouvrir dans l'éditeur. Le dernier programme est aussi gardé dans le navigateur.

## Envoi au robot (téléversement)

Makeblock ne publie pas le protocole. Il est repris de deux rétro-ingénieries indépendantes et concordantes :
[weare2plus3/cyberpi-uploader](https://github.com/weare2plus3/cyberpi-uploader) et
[dachrisch/mbot2-course-setup](https://github.com/dachrisch/mbot2-course-setup).
115 200 bauds ; trame `F3 | (F3+lenLo+lenHi)&FF | lenLo lenHi | corps | somme(corps)&FF | F4` ;
2 × [ping `0D 00 00`, exec « import config », exec « repl_enable = False »], en-tête de `/flash/_xx_main.py`,
blocs de 80 octets (le dernier de 4), ping + exec + exec, puis fermeture et réouverture du port (redémarrage).

Vérifié **sans robot** : trames, découpage, somme XOR, et un envoi complet contre un CyberPi simulé dans la page.

## À vérifier sur un vrai mBot2

1. **Envoi réel** : jamais testé sur le matériel. Si le robot ne répond pas : identifiant USB (filtre `0x1A86`,
   case « Afficher tous les ports série »), pilote CH340 / CH9102, redémarrage après réouverture du port.
2. **Sens de `get_offset_track`** (bloc « écart à la ligne ») : la documentation dit « -100 = capteur à gauche de la
   ligne » ; le simulateur suit cette convention, à confirmer.
3. **Ordre des 4 capteurs de ligne** (L2, L1, R1, R2) et réglage « voit la ligne » après calibrage du capteur.
4. **Dimensions** du simulateur : diamètre des roues 6,5 cm et entraxe 11,5 cm sont **estimés** ; à mesurer
   (`ROUE_D`, `ENTRAXE` en tête de `simulateur.js`) puis comparer `avancer de 100 cm` et `tourner de 360°`.
5. **Noms des sons** enregistrés (`hello`, `yeah`, `wow`, `laugh`, `right`, `wrong`, `level-up`, `score`, `laser`,
   `beeps`) et `display.show_label(…, index=…)`.

## Tests rapides (console du navigateur)

- `mbot2Test.chargerExemple('ligne'); mbot2Test.genererPython()` : code Python d'un exemple.
- `Simulateur.etat()` : position, vitesses, capteurs du robot simulé.
- `TeleversementTest.trame(TeleversementTest.corpsPing())` → `F3 F6 03 00 0D 00 00 0D F4`.
