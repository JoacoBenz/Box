# Flujo de Solicitud de Compra — BoxZenj

## 1. Crear solicitud (Solicitante)
El solicitante crea una nueva solicitud de compra en estado **borrador**. Completa el titulo, descripcion, justificacion, urgencia y agrega los items con cantidad, unidad y precio estimado.

## 2. Enviar solicitud (Solicitante)
El solicitante revisa la solicitud y la envia. La solicitud pasa al estado **ENVIADA**. A partir de este momento ya no puede editarla.

## 3. Validacion (Responsable de Area)
- **Si el solicitante es el responsable de area**: la solicitud se **auto-valida** y pasa directamente al estado **VALIDADA**, salteando este paso.
- **Si no**: el responsable del area revisa la solicitud y puede:
  - **Validar**: la solicitud pasa al estado **VALIDADA**.
  - **Devolver con observaciones**: la solicitud vuelve al solicitante en estado **DEVUELTA_RESP**. El solicitante corrige y re-envia.

## 4. Aprobacion (Director/a)
El director/a revisa la solicitud validada y puede:
- **Aprobar**: la solicitud pasa al estado **EN_COMPRAS**.
- **Devolver con observaciones**: la solicitud vuelve al solicitante en estado **DEVUELTA_DIR**. El solicitante corrige y re-envia desde el paso 2.
- **Rechazar**: la solicitud pasa al estado **RECHAZADA** (estado terminal, no se puede revertir).

## 5. Procesamiento de compra (Compras)
El area de compras recibe la solicitud aprobada y la procesa. Asigna la prioridad de compra (urgente, normal o programado) y el dia de pago programado. La solicitud pasa al estado **PAGO_PROGRAMADO**.

## 6. Registro de compra (Tesoreria)
Tesoreria registra la compra efectiva: carga el comprobante de pago, monto total, proveedor, medio de pago y referencia bancaria. La solicitud pasa al estado **ABONADA**.

## 7. Recepcion (Solicitante)
El solicitante confirma la recepcion de los items comprados:
- **Conforme**: la solicitud pasa directamente al estado **CERRADA** (estado terminal).
- **No conforme**: el solicitante indica el tipo de problema (faltante, danado, diferente u otro) y una descripcion. La solicitud pasa al estado **RECIBIDA_CON_OBS**.

## 8. Cierre (Compras/Tesoreria)
Si la recepcion tuvo observaciones, el area de compras o tesoreria resuelve el problema y cierra la solicitud. La solicitud pasa al estado **CERRADA** (estado terminal).

---

## Anulacion
Una solicitud puede ser **anulada** desde los estados: ENVIADA, VALIDADA, EN_COMPRAS o PAGO_PROGRAMADO. No se puede anular desde borrador ni desde estados posteriores a ABONADA.

Roles autorizados para anular:
- **Solicitante**: solo sus propias solicitudes.
- **Director/a**: cualquier solicitud de su organizacion.
- **Admin**: cualquier solicitud de su organizacion.

La anulacion requiere un motivo (minimo 10 caracteres). El estado **ANULADA** es terminal.

---

## Estados terminales
Los siguientes estados son definitivos y no permiten ninguna accion posterior:
- **RECHAZADA**: la solicitud fue rechazada por el director/a.
- **ANULADA**: la solicitud fue cancelada antes de completarse.
- **CERRADA**: la solicitud completo todo el ciclo exitosamente.

## Segregacion de funciones
- Un usuario no puede validar ni aprobar sus propias solicitudes.
- Un usuario no puede validar una solicitud que el mismo envio.
- La persona que registra la compra no puede confirmar la recepcion.
