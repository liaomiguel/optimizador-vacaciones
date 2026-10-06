# Estirá tus Días — Tus vacaciones, mejor aprovechadas

**Estirá tus Días** es una aplicación web inteligente diseñada para calcular, comparar y optimizar períodos de vacaciones en Argentina. Evalúa todas las combinaciones posibles de fechas a lo largo del año, aprovechando fines de semana, feriados nacionales, días puente y días no laborables para maximizar los días consecutivos de descanso utilizando la menor cantidad de saldo disponible.

---

## Características principales

- **Optimización determinística y completa**: Algoritmo exhaustivo con programación dinámica que analiza todas las combinaciones posibles sin cortes arbitrarios ni dependencias de IA.
- **Régimen de cómputo personalizable**:
  - **Días corridos**: Descuenta cada día dentro del período de vacaciones.
  - **Días hábiles**: Descuenta únicamente los días en que normalmente trabajarías.
  - **Personalizado**: Ajuste individual para sábados, domingos, feriados y no laborables.
- **Integración con feriados oficiales de Argentina**:
  - Consulta automática a la API pública de [ArgentinaDatos](https://argentinadatos.com/).
  - Respaldo de contingencia local para el calendario oficial 2026 (Ley 27.399 y Decreto 614/2025).
  - Posibilidad de agregar fechas particulares o modificar categorías manualmente.
- **Estrategias de optimización**:
  - **Máximo descanso**: El bloque de días libres continuos más largo posible.
  - **Máximo rendimiento**: Mayor descanso nuevo por cada día que consumís de tu saldo.
  - **Descanso distribuido**: Reparto del saldo en múltiples bloques para acumular más días libres en el año.
- **Fecha límite / Vencimiento hacia el año siguiente**:
  - Permite configurar la fecha límite para tomar las vacaciones del período (por defecto el 31 de mayo del año entrante, según la Ley de Contrato de Trabajo de Argentina).
  - El motor optimiza combinaciones que abarcan tanto el año en curso como el verano y otoño del año siguiente (Carnaval, Semana Santa, etc.).
- **Visualización clara y responsive**:
  - Tira interactiva con código de colores para días consumidos, libres y feriados.
  - Métricas verificables (descanso total, días extra, rendimiento).
  - Calendario interactivo multianual que muestra todos los meses del período activo (hasta 17 meses o más).
  - Soporte para **Modo Oscuro** y **Modo Claro** con selector y guardado de preferencias.
- **Suite de pruebas automáticas**: 17 pruebas unitarias que verifican el correcto cálculo y la integridad algorítmica.

---

## Estructura del proyecto

El código está organizado de manera modular por carpetas y responsabilidades:

```text
optimizador-vacaciones/
├── index.html          # Estructura semántica HTML5
├── Objetivo.md         # Documento con la especificación y reglas del producto
├── README.md           # Documentación del proyecto
├── netlify.toml        # Configuración de despliegue y seguridad para Netlify
├── package.json        # Configuración de scripts locales (npm start / npm test)
├── .gitignore          # Exclusiones de Git
├── css/
│   ├── theme.css       # Tokens de diseño, paleta de colores y temas claro/oscuro
│   ├── main.css        # Tipografía, layout flexible, encabezado y pie de página
│   └── components.css  # Componentes (formularios, tarjetas, calendarios, tira de días)
└── js/
    ├── engine.js       # Motor matemático de optimización (aislado, sin dependencias)
    ├── api.js          # Servicio de integración con la API ArgentinaDatos y caché
    ├── testsuite.js    # Suite de pruebas unitarias automatizadas
    └── app.js          # Controlador de interfaz, gestión de estado y renderizado
```

---

## Cómo ejecutarlo localmente

Al tratarse de una aplicación web estática (Vanilla HTML, CSS y JS), no requiere compilación previa.

### Opción 1: Con Node.js (Recomendada)
```bash
# Iniciar servidor local
npm start
```
O directamente con `npx`:
```bash
npx -y serve .
```

### Opción 2: Con Python
```bash
python3 -m http.server 8000
```
Luego abrí en tu navegador: `http://localhost:8000`

### Opción 3: Abrir directamente
Hacé doble clic en `index.html` o usá la extensión **Live Server** en tu editor de código.

---

## Pruebas automáticas

Podés ejecutar y verificar la suite de 17 pruebas unitarias de dos formas:

1. **Desde la terminal**:
   ```bash
   npm test
   ```
2. **Desde la aplicación web**:
   - Abrí la web en el navegador.
   - Desplegá la sección inferior **«Verificar el motor de cálculo (Pruebas automáticas)»**.
   - Hacé clic en **«Correr pruebas»**.

---

## Despliegue en Netlify

El repositorio ya incluye el archivo [`netlify.toml`](./netlify.toml) preconfigurado con el directorio de publicación (`.`), cabeceras de seguridad (`X-Frame-Options`, `Content-Type-Options`) y redirecciones.

### Método A: Desde GitHub / GitLab / Bitbucket (Automático)
1. Subí este repositorio a tu cuenta de GitHub.
2. Ingresá a [Netlify](https://app.netlify.com/) e iniciá sesión.
3. Hacé clic en **"Add new site"** > **"Import an existing project"**.
4. Conectá tu repositorio.
5. Netlify detectará automáticamente la configuración de `netlify.toml`:
   - **Publish directory**: `.`
   - **Build command**: *(dejar en blanco)*
6. Hacé clic en **"Deploy site"** y tu aplicación estará online al instante.

### Método B: Mediante Netlify CLI (Desde tu terminal)
```bash
# 1. Instalar o ejecutar Netlify CLI
npx netlify login

# 2. Desplegar en producción
npx netlify deploy --prod --dir=.
```

### Método C: Despliegue manual (Drag & Drop)
1. Entrá a [Netlify Drop](https://app.netlify.com/drop).
2. Arrastrá la carpeta del proyecto a la ventana del navegador.
3. ¡Listo! Tu sitio quedará publicado con una URL pública al instante.

---

## Licencia y fuentes

- **Feriados oficiales**: Datos obtenidos de [ArgentinaDatos](https://argentinadatos.com/) bajo calendario oficial de la República Argentina (Ley 27.399).
- **Licencia**: MIT.
