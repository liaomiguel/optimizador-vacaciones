# ESTIRÁ TUS DÍAS — Especificación integral del producto

## 1. Identidad y propósito

Desarrollar una aplicación web llamada **Estirá tus Días**, orientada inicialmente al público argentino.

**Título principal:** Tus vacaciones, mejor aprovechadas.

**Descripción:** Herramienta inteligente para calcular, comparar y optimizar períodos de vacaciones, aprovechando fines de semana, feriados y días no laborables para obtener la mayor cantidad posible de descanso con el saldo disponible.

El producto debe resolver un problema concreto: una persona tiene cierta cantidad de días de vacaciones y quiere descubrir qué fechas le conviene elegir para descansar más, consumiendo la menor cantidad posible de saldo.

La aplicación no debe limitarse a contar días ni a mostrar un calendario. Debe evaluar diferentes combinaciones de fechas, calcular su rendimiento y explicar cuál alternativa conviene según las prioridades del usuario.

## 2. Objetivos principales

La aplicación debe permitir:

1. Ingresar el saldo de vacaciones disponible.
2. Seleccionar el año y el rango de fechas en el que se pueden tomar las vacaciones.
3. Configurar el régimen de cómputo de vacaciones.
4. Importar automáticamente los feriados argentinos mediante una API.
5. Seleccionar qué tipos de feriados se quieren considerar.
6. Personalizar días laborales, fines de semana y días no laborables.
7. Encontrar el mejor período único de vacaciones.
8. Comparar un período largo con dos o más períodos separados.
9. Maximizar la cantidad de días consecutivos de descanso.
10. Comparar alternativas según su eficiencia.
11. Mostrar visualmente qué fechas consumen saldo y cuáles son días libres habituales.
12. Explicar los cálculos y las razones de cada recomendación.

## 3. Datos que ingresa el usuario

### Datos obligatorios

- Año de planificación.
- Cantidad de días de vacaciones disponibles.
- Régimen de cómputo.
- Calendario laboral aplicable.

### Datos opcionales

- Fecha mínima de inicio.
- Fecha máxima de finalización.
- Cantidad mínima y máxima de días por período.
- Cantidad máxima de períodos vacacionales.
- Preferencia por un período largo o varios períodos.
- Fechas que se desean evitar.
- Fechas preferidas.
- Días de la semana habituales de trabajo.
- Feriados o días no laborables particulares.
- Posibilidad de tomar vacaciones en cualquier fecha o solamente dentro de determinados rangos.

Los campos opcionales deben tener valores predeterminados razonables. La aplicación debe permitir comenzar con los datos mínimos y refinar la búsqueda posteriormente.

## 4. Configuración del régimen de vacaciones

La aplicación debe soportar dos modalidades principales.

### Régimen A: días corridos

El coste del período se calcula según las reglas de cómputo configuradas para el usuario.

La configuración debe permitir definir si cada fecha comprendida en el período consume saldo, incluidos sábados, domingos y feriados.

No se debe asumir que todos los regímenes laborales aplican exactamente la misma regla.

### Régimen B: días hábiles

El sistema debe descontar únicamente los días que sean computables según el régimen seleccionado.

Debe poder configurarse qué ocurre con:

- Sábados.
- Domingos.
- Feriados.
- Días no laborables.
- Días que no forman parte del calendario habitual de trabajo.

La aplicación debe distinguir entre el calendario de trabajo y el calendario de descuento de vacaciones.

### Reglas generales

La modalidad de cómputo y las reglas concretas de descuento deben poder modificarse sin cambiar el algoritmo de optimización.

La herramienta no debe afirmar que una configuración es legalmente aplicable a todos los trabajadores argentinos. Debe mostrar que los resultados dependen de las reglas seleccionadas.

## 5. Integración con la API de feriados argentinos

Utilizar inicialmente ArgentinaDatos como fuente de datos.

Documentación:
https://argentinadatos.com/docs/operations/get-feriados

Endpoint:
GET https://api.argentinadatos.com/v1/feriados/{año}

La respuesta documentada contiene los campos `fecha`, `tipo` y `nombre`.

### Requisitos de integración

1. Consultar automáticamente los feriados del año seleccionado.
2. Normalizar los resultados a un formato interno uniforme.
3. Identificar el origen de cada registro.
4. Mantener el tipo original de la API.
5. Crear un mapeo explícito entre los tipos recibidos y las categorías internas.
6. No inferir categorías que la fuente no permita determinar de manera fiable.
7. Permitir agregar, editar y eliminar fechas manualmente.
8. Mantener separadas las modificaciones personales y los datos importados.
9. Guardar temporalmente los datos para evitar solicitudes innecesarias.
10. Mostrar errores comprensibles cuando la API no responda.
11. Permitir utilizar los últimos datos válidos guardados.
12. Advertir cuando el calendario del año solicitado no esté disponible o esté incompleto.

La aplicación debe poder incorporar otras fuentes de datos en el futuro sin modificar el motor de optimización.

### Selector de feriados

Crear una sección de configuración llamada «Feriados y días no laborables».

Debe permitir seleccionar las categorías disponibles, por ejemplo:

- Feriados nacionales.
- Feriados trasladables.
- Días no laborables con fines turísticos.
- Feriados provinciales.
- Feriados municipales.
- Días no laborables propios del usuario.

Las categorías deben habilitarse solamente cuando puedan identificarse de forma fiable o cuando el usuario las clasifique manualmente.

La selección debe actualizar inmediatamente los cálculos.

No se deben tratar todos los feriados como equivalentes por defecto. Su efecto sobre el descanso y el saldo debe configurarse por separado.

## 6. Modelo interno del calendario

Cada fecha debe contar con los atributos necesarios para realizar los cálculos:

- Fecha.
- Día de la semana.
- Es fin de semana.
- Es feriado.
- Nombre y categoría del feriado, cuando corresponda.
- Es día habitualmente laborable.
- Es día libre habitual.
- Consume saldo de vacaciones según el régimen.
- Está excluida por las preferencias del usuario.
- Pertenece a un período vacacional seleccionado.
- Fuente de los datos.
- Estado de validación.

Como mínimo, deben existir dos atributos independientes:

`is_non_working_day`: indica si la persona normalmente tiene que trabajar ese día.

`consumes_vacation_balance`: indica si ese día consume saldo de vacaciones dentro de un período autorizado.

Un día puede ser no laborable sin consumir saldo. También puede haber días de vacaciones que sí consuman saldo.

Estos atributos deben ser calculados a partir de la configuración correspondiente, no derivados exclusivamente de que una fecha sea un feriado.

## 7. Definición de días de descanso

Un día se considera libre cuando la persona no tiene obligación de trabajar por alguno de estos motivos:

- Vacaciones autorizadas.
- Fin de semana habitual.
- Feriado o día no laborable aplicable.
- Excepción del calendario laboral.

El motor debe identificar secuencias de días libres consecutivos.

Un bloque de descanso puede comenzar antes de la fecha formal de inicio de vacaciones o finalizar después de su fecha formal de finalización, gracias a fines de semana o feriados adyacentes.

El calendario de evaluación debe incluir las fechas inmediatamente anteriores y posteriores a los períodos candidatos para detectar correctamente estas extensiones.

No se debe contar dos veces una fecha libre ni sumar automáticamente períodos que no sean consecutivos.

El sistema debe distinguir:

- Días de vacaciones consumidos.
- Días libres incluidos en los períodos.
- Mayor bloque consecutivo de descanso.
- Total de días de descanso obtenidos durante el horizonte evaluado.

Si la persona trabaja los sábados o domingos, esos días no deben considerarse libres automáticamente.

## 8. Motor de cálculo de períodos

El algoritmo debe evaluar las posibles fechas de inicio y finalización dentro del rango permitido.

Para cada período candidato:

1. Verificar que las fechas sean válidas.
2. Calcular el coste de vacaciones según el régimen.
3. Rechazar los períodos que superen el saldo disponible.
4. Aplicar las restricciones de fechas y duración.
5. Identificar los días libres que quedan conectados al período.
6. Calcular el mayor bloque consecutivo de descanso.
7. Calcular el descanso total y el saldo restante.
8. Calcular el rendimiento del período.
9. Registrar los resultados para su comparación.

Definir:

- `V`: saldo de vacaciones consumido.
- `D`: días de descanso total obtenidos en el horizonte.
- `M`: duración del mayor bloque consecutivo de descanso.
- `S`: saldo disponible inicialmente.
- `R`: saldo restante.
- `E`: rendimiento del descanso por día consumido.

El saldo restante es:

`R = S - V`

Cuando el coste es mayor que cero, el rendimiento puede calcularse como:

`E = D / V`

Si el coste es cero, el rendimiento debe mostrarse como «sin consumo de saldo» en lugar de dividir por cero.

El sistema debe documentar exactamente qué días forman parte de `D` para evitar contabilizar como beneficio días que la persona ya habría tenido libres de todas formas fuera del período evaluado.

## 9. Estrategias de optimización

La aplicación debe ofrecer tres estrategias.

### Estrategia A: máximo descanso

Objetivo principal: maximizar `M`, la cantidad de días libres consecutivos.

Desempates:

1. Mayor descanso total.
2. Menor consumo de saldo.
3. Mayor saldo restante.
4. Mejor adecuación a las preferencias del usuario.

### Estrategia B: máximo rendimiento

Objetivo principal: maximizar la cantidad de días libres adicionales obtenidos por día de vacaciones consumido.

Para esta estrategia, medir el beneficio incremental respecto del calendario sin vacaciones, de modo que los fines de semana que ya eran libres no inflen artificialmente el rendimiento.

Desempates:

1. Mayor bloque consecutivo de descanso.
2. Menor consumo de saldo para un beneficio equivalente.
3. Mejor adecuación a las preferencias del usuario.

### Estrategia C: descanso distribuido

Objetivo principal: repartir el descanso a lo largo del año y aprovechar diferentes oportunidades del calendario.

Considerar:

- Cantidad de bloques de descanso.
- Duración de cada bloque.
- Distribución temporal.
- Saldo consumido.
- Aprovechamiento de distintos feriados.

No debe favorecer arbitrariamente una cantidad de períodos sin que exista una preferencia explícita del usuario.

La interfaz debe explicar qué estrategia se está utilizando y por qué el resultado puede cambiar cuando cambia la prioridad.

## 10. Comparación entre un período y varios períodos

La aplicación debe evaluar dos escenarios.

### Escenario A: un único período

Buscar la mejor combinación de inicio y finalización que respete el saldo y las restricciones.

### Escenario B: varios períodos

Buscar combinaciones de dos o más períodos no superpuestos.

Para cada combinación:

1. Sumar el coste de los períodos.
2. Verificar que el consumo total no supere el saldo.
3. Aplicar las restricciones de duración mínima y máxima.
4. Verificar las separaciones entre períodos, cuando existan.
5. Construir el calendario completo de descanso.
6. Identificar los bloques consecutivos.
7. Calcular el descanso incremental y el rendimiento.
8. Comparar la combinación con el mejor período único.

No se deben combinar períodos que se superpongan ni contabilizar dos veces el saldo o los días de descanso.

La aplicación debe indicar cuándo dividir las vacaciones produce un mejor resultado y cuándo conviene concentrarlas en un único período.

Si el usuario no impone una cantidad fija de períodos, el algoritmo debe evaluar las opciones válidas hasta el máximo configurado.

## 11. Algoritmo y rendimiento

Implementar inicialmente un algoritmo determinista y reproducible.

Para un año calendario:

1. Generar todos los períodos válidos.
2. Calcular y almacenar sus costes y métricas.
3. Descartar candidatos dominados por alternativas claramente mejores bajo los mismos objetivos y restricciones.
4. Para varios períodos, combinar candidatos compatibles mediante búsqueda con poda o programación dinámica.
5. Conservar las mejores alternativas de cada estrategia.
6. Comparar el mejor resultado de un período con el de múltiples períodos.

No utilizar inteligencia artificial para decidir qué fechas son óptimas. Los resultados deben surgir de cálculos verificables.

Si se incorporan límites de búsqueda por rendimiento, la aplicación debe informar cuando no haya explorado todas las combinaciones. No debe presentar una solución aproximada como si estuviera garantizado que es la mejor.

## 12. Presentación de resultados

Mostrar una recomendación principal y alternativas comparables.

Cada resultado debe incluir:

- Nombre de la estrategia.
- Fecha de inicio y finalización.
- Días de vacaciones consumidos.
- Saldo restante.
- Días libres totales.
- Mayor bloque consecutivo.
- Rendimiento por día consumido.
- Feriados aprovechados.
- Explicación de por qué la alternativa es conveniente.

Permitir comparar:

- Mejor período único.
- Mejor combinación de varios períodos.
- Mejor alternativa por rendimiento.
- Alternativa que maximiza el descanso consecutivo.

El calendario visual debe distinguir claramente:

- Días de vacaciones.
- Fines de semana.
- Feriados.
- Días laborables habituales.
- Días libres que extienden el descanso.
- Días que consumen saldo.

Los colores deben acompañarse de etiquetas o leyendas accesibles.

## 13. Transparencia de los cálculos

El usuario debe poder abrir el detalle de una recomendación y ver cómo se obtuvo cada cifra.

La aplicación debe mostrar:

- Qué fechas se descontaron.
- Qué fechas no consumieron saldo.
- Qué feriados se tuvieron en cuenta.
- Qué regla se aplicó a cada categoría.
- Cómo se calcularon los bloques de descanso.
- Qué restricciones descartaron otras opciones.

Si el calendario está incompleto, el resultado debe identificarse como provisional.

## 14. Casos límite y validaciones

Contemplar:

- Saldo de vacaciones igual a cero.
- Saldo inferior al mínimo requerido.
- Ningún feriado en el rango.
- Feriados consecutivos.
- Feriados que coinciden con fines de semana.
- Días laborables no habituales.
- Rangos de fechas incompletos.
- Fechas excluidas.
- Años futuros no disponibles en la API.
- Fallos de conexión.
- Períodos que consumen cero días según una configuración particular.
- Combinaciones que agotan exactamente el saldo.
- Períodos que comienzan o terminan en un fin de semana.
- Diferencias entre días libres totales y días libres adicionales.
- Restricciones incompatibles entre sí.

No permitir resultados con saldo negativo ni períodos inválidos.

## 15. Arquitectura y mantenibilidad

Separar las responsabilidades en módulos independientes:

1. Proveedor de feriados.
2. Normalizador y validador de calendarios.
3. Configuración de reglas laborales.
4. Motor de cómputo de vacaciones.
5. Motor de detección de descanso consecutivo.
6. Generador de períodos candidatos.
7. Optimizador de períodos múltiples.
8. Comparador y clasificador de resultados.
9. Interfaz de calendario y recomendaciones.

La integración con ArgentinaDatos debe estar aislada del motor matemático para poder reemplazar la fuente de datos sin reescribir la lógica de optimización.

## 16. Pruebas y criterios de aceptación

Crear pruebas automatizadas que verifiquen:

- El coste de un período en ambos regímenes.
- La clasificación correcta de fines de semana y feriados.
- El cálculo del saldo restante.
- La detección de bloques consecutivos.
- El efecto de incluir o excluir feriados.
- La comparación entre períodos únicos y múltiples.
- La ausencia de doble contabilización.
- La aplicación de todas las restricciones.
- La estabilidad de los resultados ante los mismos datos de entrada.
- El comportamiento cuando faltan datos de la API.

Utilizar calendarios de prueba con fechas y resultados esperados definidos explícitamente.

La aplicación se considerará funcionalmente correcta cuando todas las recomendaciones respeten las reglas configuradas y las métricas mostradas puedan reproducirse mediante las mismas entradas.

## 17. Resultado esperado

Construir una herramienta web clara, rápida, intuitiva y confiable que permita a cualquier persona descubrir cuándo le conviene tomarse vacaciones.

La propuesta de valor es concreta:

**Estirá tus Días: descansá más, aprovechá mejor tus vacaciones y elegí las fechas con información, no a ciegas.**