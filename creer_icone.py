"""EasyBloc mBot2 - fabrication de l'icone de l'exe (icone.ico + icone.png), nov. 2026.

Meme principe que l'icone micro:bit (variante B choisie par l'utilisateur) : le robot dessine de face sur un carre
arrondi bleu nuit #1f2b6b, la couleur du bandeau. Dessin a 1024 px puis reduit (16 a 256 px). Aucune photo.
Lancement depuis le dossier du projet :  python creer_icone.py
"""
import os, sys
from PIL import Image, ImageDraw

G = 1024 / 100.0
def R(d, x, y, w, h, ray, c, contour=None, ep=0):
    d.rounded_rectangle([x * G, y * G, (x + w) * G, (y + h) * G], radius=ray * G, fill=c,
                        outline=contour, width=int(ep * G) if ep else 0)
def C(d, cx, cy, ray, c):
    d.ellipse([(cx - ray) * G, (cy - ray) * G, (cx + ray) * G, (cy + ray) * G], fill=c)

def fond(d):
    R(d, 2, 2, 96, 96, 22, '#1f2b6b')

def roues(d, y=58, h=30):
    for x in (9, 77):
        R(d, x, y, 14, h, 4, '#16161a')
        for k in range(5):
            R(d, x + 2, y + 3 + k * (h - 6) / 5, 10, 2.2, 1, '#3a3a42')

def mbot2():
    im = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fond(d)
    roues(d, y=60, h=28)
    R(d, 20, 54, 60, 34, 7, '#455a64')                  # chassis gris
    R(d, 20, 54, 60, 6, 4, '#78909c')
    R(d, 26, 10, 48, 30, 6, '#eceff1')                  # CyberPi
    R(d, 33, 14, 34, 20, 3, '#0d1b2a')                  # son ecran
    C(d, 43, 22, 2.6, '#40c4ff'); C(d, 57, 22, 2.6, '#40c4ff')   # petit visage a l'ecran
    d.arc([43 * G, 21 * G, 57 * G, 31 * G], 20, 160, fill='#40c4ff', width=int(1.8 * G))
    R(d, 30, 40, 40, 16, 4, '#263238')                  # capteur a ultrasons 2
    for cx in (40, 60):
        C(d, cx, 48, 7.5, '#1e88e5'); C(d, cx, 48, 5, '#263238'); C(d, cx, 48, 3, '#546e7a')
    return im

def ecrire(im, dossier):
    tailles = [256, 128, 64, 48, 32, 24, 16]
    imgs = [im.resize((t, t), Image.LANCZOS) for t in tailles]
    imgs[0].save(os.path.join(dossier, 'icone.ico'), format='ICO', sizes=[(t, t) for t in tailles], append_images=imgs[1:])
    imgs[0].save(os.path.join(dossier, 'icone.png'))

if __name__ == '__main__':
    ecrire(mbot2(), os.path.dirname(os.path.abspath(__file__)))
    print('icone.ico et icone.png ecrits')
