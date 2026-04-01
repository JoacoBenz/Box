-- CreateIndex
CREATE INDEX "compras_tenant_id_solicitud_id_idx" ON "compras"("tenant_id", "solicitud_id");

-- CreateIndex
CREATE INDEX "log_auditoria_tenant_id_created_at_idx" ON "log_auditoria"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notificaciones_tenant_id_usuario_destino_id_leida_idx" ON "notificaciones"("tenant_id", "usuario_destino_id", "leida");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_estado_idx" ON "solicitudes"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_solicitante_id_idx" ON "solicitudes"("tenant_id", "solicitante_id");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_area_id_idx" ON "solicitudes"("tenant_id", "area_id");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_estado_area_id_idx" ON "solicitudes"("tenant_id", "estado", "area_id");
