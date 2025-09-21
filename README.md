# Biblioteca FRGP

Sitio estático para navegar parciales, finales y material de la FRGP/UTN. El contenido se organiza mediante `index.json` y los PDFs viven en la carpeta `/files`.

## Estructura

```
├── index.html       # UI principal (breadcrumbs, buscador, vista previa)
├── index.json       # Manifiesto con la jerarquía de carpetas/archivos
├── files/           # PDFs reales (nombres controlados)
└── tools/
    └── ingest-files.mjs  # Script que agrega los nuevos archivos al manifiesto
```

## Flujo para agregar nuevos archivos

1. Nombrá el archivo como `Carpeta_Subcarpeta_Subcarpeta_NombreDelArchivo.pdf`.
   - `Carpeta`: carrera o "Básicas".
   - `Subcarpeta`: materia.
   - `Subcarpeta`: carpeta final (`Parciales`, `Finales`, `Material de estudio`).
   - `NombreDelArchivo`: texto libre (podés usar guiones `-` o espacios-`CamelCase`).
2. Copiá el PDF a la carpeta `files/`.
3. Ejecutá el script de ingestión:
   ```bash
   npm run ingest
   ```
   - Usa `npm run ingest:dry` para ver qué se agregaría sin modificar `index.json`.
   - Ajustá la profundidad de carpetas con `node tools/ingest-files.mjs --depth 4` si necesitás un nivel extra.
4. Revisá los cambios en `index.json`, probá localmente abriendo `index.html` y hacé commit.

## Vista previa de PDFs

- La vista previa intenta usar PDF.js desde CDN. Si el archivo bloquea CORS, se cae a un `<iframe>` con `#zoom=page-width`.
- El botón ✕ cierra la superposición, devuelve el foco y desbloquea el scroll del body.

## Personalización rápida

- Correo del mensaje de colaboración: editá la constante `CONTACT_EMAIL` en `index.html`.
- Ancho del contenido central: ajustá `--wrap-width` en la sección `:root` del CSS.
- Tema inicial: se toma de `localStorage` o `prefers-color-scheme`. El botón alterna claro/oscuro.

## Accesibilidad y rendimiento

- Breadcrumbs con enlaces y foco visible.
- Preferencias de movimiento reducidas respetadas (transiciones casi nulas).
- Vista previa bloquea el scroll del body al abrir y lo libera al cerrar.
- Sin dependencias pesadas, solo PDF.js cuando se necesita renderizar un PDF.

## Flags opcionales

- Para experimentar con anuncios (Ezoic/AdSense) podés ampliar el atributo `data-rail` en los `<aside>` laterales.
- El hook GA4 no está activo; podés inyectar tu snippet justo antes del cierre del `<body>` si lo necesitás.

¡Gracias por colaborar con la biblioteca! Si tenés dudas escribí a `CONTACT_EMAIL`.
