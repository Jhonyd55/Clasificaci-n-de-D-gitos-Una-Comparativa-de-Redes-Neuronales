import http.server
import socketserver
import webbrowser
import os

# Configura el puerto
PORT = 8000

# Obtiene el directorio actual donde está este script
directorio = os.path.abspath(os.path.dirname(__file__))
os.chdir(directorio)

# Inicia el servidor
Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Servidor iniciado en http://localhost:{PORT}")
    
    # Abre automáticamente el navegador en index.html si existe
    index_path = os.path.join(directorio, "index.html")
    if os.path.exists(index_path):
        webbrowser.open(f"http://localhost:{PORT}/index.html")

    # Mantiene el servidor corriendo
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
