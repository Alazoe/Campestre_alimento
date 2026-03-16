# 🥚 Huevos La Campestre — Sistema de Gestión Avícola

> **Andrés Lazo Escobar MV** · andreslazomv@outlook.com · +56 9 5895 6340  
> Repositorio: `github.com/Alazoe/Camprestre_alimento`  
> Sheet maestro: [La Campestre - Registros](https://docs.google.com/spreadsheets/d/1mL9aBs-4UPpQW-iJBxBc3Wbh2Xg88svi5uUK2qeBpAI/edit)

---

## 🔗 Links de acceso rápido

### Panel administrador (Andrés)
| Acceso | URL |
|--------|-----|
| **Admin — Entregas y Dashboard** | [avivet.cl/Campestre_alimento/Admin.html](http://avivet.cl/Campestre_alimento/Admin.html) |
| Clave de acceso | `campestre2024` |

### Apps por productor
| Productor | Link directo |
|-----------|-------------|
| Criadero Epulef | [avivet.cl/Campestre_alimento/?p=epulef-criadero](http://avivet.cl/Campestre_alimento/?p=epulef-criadero) |
| Frank Epulef | [avivet.cl/Campestre_alimento/?p=epulef-frank](http://avivet.cl/Campestre_alimento/?p=epulef-frank) |
| Agrícola Ñanculén | [avivet.cl/Campestre_alimento/?p=nanculen](http://avivet.cl/Campestre_alimento/?p=nanculen) |
| Avícola Emplumados | [avivet.cl/Campestre_alimento/?p=emplumados](http://avivet.cl/Campestre_alimento/?p=emplumados) |
| Juan Becerra | [avivet.cl/Campestre_alimento/?p=becerra](http://avivet.cl/Campestre_alimento/?p=becerra) |
| Cristian Vergara | [avivet.cl/Campestre_alimento/?p=vergara](http://avivet.cl/Campestre_alimento/?p=vergara) |
| Huevos Calibú | [avivet.cl/Campestre_alimento/?p=calibu](http://avivet.cl/Campestre_alimento/?p=calibu) |
| Roberto Santelices | [avivet.cl/Campestre_alimento/?p=santelices](http://avivet.cl/Campestre_alimento/?p=santelices) |
| Juan Pablo Herrera | [avivet.cl/Campestre_alimento/?p=herrera](http://avivet.cl/Campestre_alimento/?p=herrera) |
| Copihue Real | [avivet.cl/Campestre_alimento/?p=copihue-real](http://avivet.cl/Campestre_alimento/?p=copihue-real) |

> 💡 También puedes ver todos los links desde el Sheet: menú **🥚 La Campestre → Ver links de productores**

---

## 📁 Archivos del sistema

| Archivo | Descripción |
|---------|-------------|
| `index.html` | App web de los productores (registro diario) |
| `Admin.html` | App de Andrés (entregas, historial, dashboard) |
| `backend.gs` | Google Apps Script — motor del sistema |
| `README.md` | Este archivo |

---

## 🗂️ Hojas del Google Sheet

| Hoja | Contenido |
|------|-----------|
| `DASHBOARD` | Resumen automático de todos los productores |
| `REGISTROS` | Todos los registros diarios recibidos |
| `LOTES` | Pabellones/lotes por productor con aves y fecha nacimiento |
| `STOCK_PRODUCTORES` | Stock neto de alimento por productor |
| `ENTREGAS_ALIMENTO` | Historial de entregas registradas por Andrés |

---

## 📱 Guía para el productor — primera vez

### 1. Guardar el link en el celular
Enviar el link por WhatsApp. El productor debe guardarlo en la pantalla de inicio:
- **iPhone:** Safari → botón compartir → "Agregar a pantalla de inicio"
- **Android:** Chrome → menú ⋮ → "Agregar a pantalla de inicio"

### 2. Configurar el primer lote
Al entrar por primera vez aparece automáticamente un formulario de configuración:

| Campo | ¿Obligatorio? | Notas |
|-------|:---:|-------|
| Nombre del lote | ✅ | ej: Pabellón 1, Lote A |
| N° de aves | ✅ | Aves al momento de ingresar |
| Fecha de nacimiento | ⚠️ opcional | Si no la ingresa, aparece alerta — se puede agregar después |

> Si no ingresa la fecha de nacimiento, el sistema muestra una alerta recordándole agregarla. Sin esa fecha no se puede calcular la semana de vida ni las alertas de etapa productiva.

### 3. Registro diario
Campos del formulario:

| Campo | ¿Obligatorio? | Notas |
|-------|:---:|-------|
| Fecha | ✅ | Por defecto = hoy |
| Lote activo | ✅ | Se selecciona tocando la tarjeta |
| Alimento entregado (kg por tipo de dieta) | ✅ | Al menos un tipo debe tener kg > 0 |
| Aves muertas | opcional | Botones +/− para facilitar el ingreso |
| Huevos recolectados | opcional | Total del día |
| Observaciones | opcional | Texto libre |

> La dieta queda guardada automáticamente. La próxima vez aparece pre-destacada.

### 4. Agregar un lote nuevo
Desde la pestaña **Registro**, botón **+ Agregar lote**. Requiere nombre y n° de aves. Queda guardado en el Sheet de inmediato.

### 5. Dar de baja un lote
Toca el botón **×** en el lote que quieras desactivar. El historial se conserva, solo deja de aparecer en el formulario.

---

## 📦 Guía para Andrés — registro de entregas

### Registrar una entrega mensual
1. Entrar a [Admin.html](http://avivet.cl/Campestre_alimento/Admin.html) con la clave
2. Pestaña **+ Nueva entrega**
3. Seleccionar productor y fecha
4. Ingresar sacos por tipo de dieta (1 saco = 25 kg)
5. Clic en **Registrar entrega**

El stock del productor se actualiza automáticamente en el Sheet. Cada registro diario del productor descuenta de ese stock.

### Tipos de dieta disponibles
`Inicial` · `Recría` · `Pre-postura` · `Ponedora 1` · `Ponedora 2` · `Otro`

### Ver el dashboard
Pestaña **Dashboard** en el Admin — muestra stock estimado en días por productor con alertas de color:
- 🟢 OK — más de 12 días
- 🟡 Atención — entre 5 y 12 días
- 🔴 Urgente — 5 días o menos

---

## 🔧 Mantenimiento técnico

### Actualizar el sistema (cuando hay cambios en los archivos)
1. Sube los archivos nuevos al repo `Camprestre_alimento` en GitHub
2. Si cambió `backend.gs`: en Apps Script → **Implementar → Administrar implementaciones → editar → Nueva versión → Implementar**
3. La URL del script no cambia al crear nueva versión

### Agregar un productor nuevo
1. En `index.html` y `Admin.html`, agregar una línea al objeto `PRODUCTORES`:
```javascript
'slug-nuevo': { nombre: 'Nombre del Productor' },
```
2. El slug debe ser único, sin tildes, minúsculas y con guiones (ej: `jose-gutierrez`)
3. Su link quedará en: `http://avivet.cl/Campestre_alimento/?p=slug-nuevo`
4. Subir los archivos actualizados al repo

### Cambiar la clave de acceso del Admin
En `Admin.html`, buscar la línea:
```javascript
const CLAVE = 'campestre2024';
```
Reemplazar `campestre2024` por la clave nueva y subir el archivo.

---

## ⚙️ Configuración técnica

| Parámetro | Valor |
|-----------|-------|
| Consumo estimado base | 115 g/ave/día |
| Peso por saco | 25 kg |
| Alerta stock urgente | ≤ 5 días |
| Alerta stock atención | ≤ 12 días |
| Semana mínima postura | 17 semanas |
| Apps Script URL | `https://script.google.com/macros/s/AKfycbxEbhLAa_fsOCdBy3tlHLMaGESt7n-UQ1RdnPWEy-AmMM5VDm9UZlVzYNkf7fUWWSJn9A/exec` |

---

*Última actualización: Marzo 2026*
