"""Serveur local de l'editeur mBot2 (Technologie Services).

Sert le dossier de l'application sur http://localhost:8020 et ouvre le
navigateur. Le televersement vers le robot se fait depuis la page (Web Serial,
Chrome ou Edge) : ce serveur ne sert que des fichiers.

Options :
  --sans-navigateur   n'ouvre pas le navigateur (apercu integre, tests).
"""

import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = 8020
# Numero de version : a tenir identique dans le menu Aide (index.html).
VERSION = "V1.0"


def dossier_de_lapplication():
    """Le dossier contenant index.html et lib/ (sys._MEIPASS pour un exe PyInstaller)."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


class Serveur(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # Pas sous Windows : cette option y laisse deux serveurs ecouter le meme port.
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


class Handler(http.server.SimpleHTTPRequestHandler):
    """Sert les fichiers en interdisant leur mise en cache.

    Sans ces en-tetes, le navigateur ressert un ancien fichier .js apres
    modification et l'on teste la version precedente sans s'en apercevoir.
    """

    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map,
                          **{".js": "text/javascript", ".py": "text/plain; charset=utf-8"})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        pass  # journal silencieux : la console reste lisible


if __name__ == "__main__":
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")

    os.chdir(dossier_de_lapplication())
    print("Programmation mBot2 - version %s" % VERSION)
    print("Dossier servi :", os.getcwd())

    # Port 8020 de preference (les editeurs micro:bit utilisent 8000 a 8009) ; sinon les neuf suivants.
    httpd = None
    for port in range(PORT, PORT + 10):
        try:
            httpd = Serveur(("", port), Handler)
            break
        except OSError as erreur:
            print("Port %d indisponible : %s" % (port, erreur))
    if httpd is None:
        print("Aucun port libre entre %d et %d." % (PORT, PORT + 9))
        sys.exit(1)

    url = "http://localhost:%d" % port
    if "--sans-navigateur" not in sys.argv:
        threading.Timer(0.5, webbrowser.open, [url]).start()
    print("Application disponible sur", url)
    print("Fermez cette fenetre pour arreter le serveur.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArret du serveur.")
    finally:
        httpd.server_close()
