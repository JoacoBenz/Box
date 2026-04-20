export interface ThemeTokens {
  // Backgrounds
  bgLayout: string;
  bgCard: string;
  bgInput: string;
  bgCardHover: string;

  // Accent
  colorPrimary: string;
  colorSecondary: string;
  primaryGlow: string; // for box-shadows

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  borderColor: string;
  borderSubtle: string;

  // Specific
  authGradient: string;
  authCircle1: string;
  authCircle2: string;
  authCircle3: string;
  sidebarBg: string;
  sidebarBorder: string;
  logoGradient: string;
  headerBg: string;
  headerBorder: string;
  headerShadow: string;
  searchBgActive: string;
  searchBgInactive: string;
  searchShadow: string;
  avatarGradient: string;
  notifBg: string;
  notifUnreadBg: string;
  notifAccent: string;

  // Cards & surfaces
  glassBg: string;
  glassBorder: string;
  glassHoverShadow: string;
  solicitudCardBg: string;
  solicitudCardBorder: string;

  // Status backgrounds (for detail page hero)
  statusBgBorrador: string;
  statusBgEnviada: string;
  statusBgDevuelta: string;
  statusBgValidada: string;
  statusBgAprobada: string;
  statusBgRechazada: string;
  statusBgAbonada: string;
  statusBgRecibida: string;
  statusBgRecibidaObs: string;
  statusBgCerrada: string;

  // Urgencia row bg
  urgenciaRowUrgente: string;
  urgenciaRowCritica: string;

  // Error
  colorError: string;

  // Observation/rejection text
  colorObservation: string;
  colorRejection: string;

  // Estimated total
  totalEstimatedBg: string;
  totalEstimatedBorder: string;
  totalEstimatedText: string;

  // Archivo groups
  archivoSolicitudBg: string;
  archivoCompraColor: string;
  archivoCompraBg: string;
  archivoRecepcionColor: string;
  archivoRecepcionBg: string;

  // Skeleton
  skeletonBg: string;

  // Admin banner
  adminBannerBg: string;
  adminBannerBorder: string;
  adminBannerText: string;
  adminBannerBtn: string;

  // Charts
  chartPrimaryGradient: string;
  chartSecondaryGradient: string;
  progressStrokeFrom: string;
  progressStrokeTo: string;

  // Misc
  rankBg: string;
  rankText: string;
  loginCardBg: string;
  loginDivider: string;
  loginContinueBg: string;
  forgotPasswordColor: string;
  loginBtnTextColor: string;

  // TenantSelector
  tenantSelectorBg: string;
  tenantSelectorBorder: string;
}

export const lightTokens: ThemeTokens = {
  bgLayout: '#f8fafc',
  bgCard: '#ffffff',
  bgInput: '#ffffff',
  bgCardHover: '#f8fafc',

  colorPrimary: '#4f46e5',
  colorSecondary: '#7c3aed',
  primaryGlow: 'rgba(79, 70, 229, 0.3)',

  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',

  borderColor: '#e2e8f0',
  borderSubtle: '#f1f5f9',

  authGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  authCircle1: 'rgba(255, 255, 255, 0.08)',
  authCircle2: 'rgba(255, 255, 255, 0.06)',
  authCircle3: 'rgba(255, 255, 255, 0.05)',
  sidebarBg: 'linear-gradient(180deg, #fafbff 0%, #f1f0ff 100%)',
  sidebarBorder: '#f1f5f9',
  logoGradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  headerBg: '#ffffff',
  headerBorder: '#e2e8f0',
  headerShadow: '0 1px 3px rgb(0 0 0 / 0.04)',
  searchBgActive: '#ffffff',
  searchBgInactive: '#fafafa',
  searchShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)',
  avatarGradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  notifBg: '#ffffff',
  notifUnreadBg: '#f6ffed',
  notifAccent: '#52c41a',

  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.4)',
  glassHoverShadow: '0 12px 32px rgb(0 0 0 / 0.1)',
  solicitudCardBg: '#ffffff',
  solicitudCardBorder: '#e2e8f0',

  statusBgBorrador: '#f1f5f9',
  statusBgEnviada: '#eff6ff',
  statusBgDevuelta: '#fffbeb',
  statusBgValidada: '#ecfeff',
  statusBgAprobada: '#f0fdf4',
  statusBgRechazada: '#fef2f2',
  statusBgAbonada: '#faf5ff',
  statusBgRecibida: '#f7fee7',
  statusBgRecibidaObs: '#fff7ed',
  statusBgCerrada: '#f1f5f9',

  urgenciaRowUrgente: '#fff7ed',
  urgenciaRowCritica: '#fef2f2',

  colorError: '#ef4444',

  colorObservation: '#d46b08',
  colorRejection: '#cf1322',

  totalEstimatedBg: '#f0fdf4',
  totalEstimatedBorder: '#bbf7d0',
  totalEstimatedText: '#15803d',

  archivoSolicitudBg: '#eef2ff',
  archivoCompraColor: '#0891b2',
  archivoCompraBg: '#ecfeff',
  archivoRecepcionColor: '#16a34a',
  archivoRecepcionBg: '#f0fdf4',

  skeletonBg: '#e2e8f0',

  adminBannerBg: 'linear-gradient(135deg, #fff7ed, #fed7aa)',
  adminBannerBorder: '#fdba74',
  adminBannerText: '#9a3412',
  adminBannerBtn: '#ea580c',

  chartPrimaryGradient: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
  chartSecondaryGradient: 'linear-gradient(90deg, #22c55e, #16a34a)',
  progressStrokeFrom: '#8b5cf6',
  progressStrokeTo: '#a855f7',

  rankBg: '#f1f5f9',
  rankText: '#64748b',
  loginCardBg: '#ffffff',
  loginDivider: '#e5e7eb',
  loginContinueBg: '#ffffff',
  forgotPasswordColor: '#6366f1',
  loginBtnTextColor: '#ffffff',

  tenantSelectorBg: 'linear-gradient(135deg, #f0f0ff, #e8e5ff)',
  tenantSelectorBorder: '#d9d6fe',
};

export const darkTokens: ThemeTokens = {
  bgLayout: '#0D1B2A',
  bgCard: '#142233',
  bgInput: '#1B2838',
  bgCardHover: '#1B2838',

  colorPrimary: '#00C2CB',
  colorSecondary: '#00E5D0',
  primaryGlow: 'rgba(0, 194, 203, 0.3)',

  textPrimary: '#FFFFFF',
  textSecondary: '#B0C4D0',
  textMuted: '#6B8A9E',

  borderColor: 'rgba(0, 194, 203, 0.2)',
  borderSubtle: 'rgba(0, 194, 203, 0.1)',

  authGradient: 'linear-gradient(135deg, #0D1B2A 0%, #142233 100%)',
  authCircle1: 'rgba(0, 194, 203, 0.08)',
  authCircle2: 'rgba(0, 194, 203, 0.06)',
  authCircle3: 'rgba(0, 194, 203, 0.05)',
  sidebarBg: 'linear-gradient(180deg, #0D1B2A 0%, #0f1e2e 100%)',
  sidebarBorder: 'rgba(0, 194, 203, 0.1)',
  logoGradient: 'linear-gradient(135deg, #00C2CB, #00E5D0)',
  headerBg: '#142233',
  headerBorder: 'rgba(0, 194, 203, 0.15)',
  headerShadow: '0 1px 3px rgb(0 0 0 / 0.2)',
  searchBgActive: '#1B2838',
  searchBgInactive: '#1B2838',
  searchShadow: '0 0 0 3px rgba(0, 194, 203, 0.15)',
  avatarGradient: 'linear-gradient(135deg, #00C2CB, #00E5D0)',
  notifBg: '#1B2838',
  notifUnreadBg: 'rgba(0, 194, 203, 0.08)',
  notifAccent: '#00C2CB',

  glassBg: 'rgba(20, 34, 51, 0.8)',
  glassBorder: 'rgba(0, 194, 203, 0.1)',
  glassHoverShadow: '0 12px 32px rgb(0 0 0 / 0.3)',
  solicitudCardBg: '#142233',
  solicitudCardBorder: 'rgba(0, 194, 203, 0.15)',

  statusBgBorrador: '#1B2838',
  statusBgEnviada: 'rgba(59,130,246,0.1)',
  statusBgDevuelta: 'rgba(249,115,22,0.1)',
  statusBgValidada: 'rgba(0,194,203,0.1)',
  statusBgAprobada: 'rgba(34,197,94,0.1)',
  statusBgRechazada: 'rgba(249,97,103,0.1)',
  statusBgAbonada: 'rgba(139,92,246,0.1)',
  statusBgRecibida: 'rgba(132,204,22,0.1)',
  statusBgRecibidaObs: 'rgba(249,115,22,0.1)',
  statusBgCerrada: '#1B2838',

  urgenciaRowUrgente: 'rgba(249, 115, 22, 0.08)',
  urgenciaRowCritica: 'rgba(249, 97, 103, 0.08)',

  colorError: '#F96167',

  colorObservation: '#f59e0b',
  colorRejection: '#F96167',

  totalEstimatedBg: 'rgba(34,197,94,0.1)',
  totalEstimatedBorder: 'rgba(34,197,94,0.2)',
  totalEstimatedText: '#22c55e',

  archivoSolicitudBg: 'rgba(0,194,203,0.08)',
  archivoCompraColor: '#00C2CB',
  archivoCompraBg: 'rgba(8,145,178,0.08)',
  archivoRecepcionColor: '#16a34a',
  archivoRecepcionBg: 'rgba(22,163,74,0.08)',

  skeletonBg: 'rgba(0, 194, 203, 0.15)',

  adminBannerBg: 'rgba(249, 97, 103, 0.1)',
  adminBannerBorder: 'rgba(249, 97, 103, 0.2)',
  adminBannerText: '#F96167',
  adminBannerBtn: '#F96167',

  chartPrimaryGradient: 'linear-gradient(90deg, #00C2CB, #00E5D0)',
  chartSecondaryGradient: 'linear-gradient(90deg, #22c55e, #16a34a)',
  progressStrokeFrom: '#00C2CB',
  progressStrokeTo: '#00E5D0',

  rankBg: '#1B2838',
  rankText: '#B0C4D0',
  loginCardBg: '#142233',
  loginDivider: 'rgba(0, 194, 203, 0.15)',
  loginContinueBg: '#142233',
  forgotPasswordColor: '#00E5D0',
  loginBtnTextColor: '#0D1B2A',

  tenantSelectorBg: 'rgba(0, 194, 203, 0.08)',
  tenantSelectorBorder: 'rgba(0, 194, 203, 0.2)',
};
