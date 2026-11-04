# Tailwind compilado (opcional, recomendado cuando ya tengas dominio)

Hoy la página carga Tailwind desde `cdn.tailwindcss.com`, que está pensado para pruebas:
compila en el celular del cliente en cada visita (más lento) y depende de un servicio externo.
Funciona, pero conviene pasar a un archivo CSS propio. Se hace una vez en tu computadora:

1. Instalá Node.js (nodejs.org).
2. En esta carpeta (`herramientas/tailwind`) abrí una terminal y corré:
   `npx tailwindcss@3.4.17 -c tailwind.config.js -i entrada.css -o ../../css/tailwind.css --minify`
3. En `index.html`:
   - borrá la línea `<script src="https://cdn.tailwindcss.com"></script>`
   - borrá la línea `<script src="js/tailwind-config.js"></script>`
   - agregá, junto a `css/styles.css`: `<link rel="stylesheet" href="css/tailwind.css">`
4. En `sw.js` agregá `'/css/tailwind.css'` a PRECACHE y subí el número de VERSION.
5. Subí todo a GitHub. Repetí el paso 2 cada vez que uses una clase de Tailwind nueva.
