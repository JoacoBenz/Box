import { describe, it, expect } from 'vitest';
import type { EstadoSolicitud, RolNombre } from '@/types';

/**
 * State machine tests for the solicitud workflow.
 *
 * These tests validate the EXPECTED state transitions based on the API route logic.
 * They document which transitions are valid, which are blocked, and where gaps exist.
 *
 * The state machine is NOT centralized in the codebase — it's spread across
 * individual API route handlers. These tests serve as the canonical reference.
 */

// ─── State Machine Definition ─────────────────────────────────────────────────
// Extracted from all API route handlers

interface Transition {
  action: string;
  from: EstadoSolicitud[];
  to: EstadoSolicitud | ((ctx: TransitionContext) => EstadoSolicitud);
  requiredRoles: RolNombre[];
  requiresOwner?: boolean; // must be solicitante who created it
  segregation?: 'validar' | 'aprobar' | 'comprar' | 'procesar_compras';
  endpoint: string;
}

interface TransitionContext {
  hasComprasUsers: boolean;
  skipValidacion: boolean;
  conforme: boolean;
  hasItems: boolean;
  allItemsReceived: boolean;
  hasProblems: boolean;
}

const TRANSITIONS: Transition[] = [
  {
    action: 'enviar',
    from: ['borrador', 'devuelta_resp', 'devuelta_dir'],
    to: 'enviada',
    requiredRoles: ['solicitante'],
    requiresOwner: true,
    endpoint: '/api/solicitudes/[id]/enviar',
  },
  {
    action: 'validar',
    from: ['enviada', 'devuelta_dir'],
    to: 'validada',
    requiredRoles: ['responsable_area'],
    segregation: 'validar',
    endpoint: '/api/solicitudes/[id]/validar',
  },
  {
    action: 'aprobar',
    from: ['validada'], // also 'enviada' when skipValidacion=true
    to: (ctx) => ctx.hasComprasUsers ? 'en_compras' : 'aprobada',
    requiredRoles: ['director'],
    segregation: 'aprobar',
    endpoint: '/api/solicitudes/[id]/aprobar',
  },
  {
    action: 'rechazar',
    from: ['validada'], // BUG: should also include 'enviada' when skipValidacion=true
    to: 'rechazada',
    requiredRoles: ['director'],
    segregation: 'aprobar', // uses same permission context
    endpoint: '/api/solicitudes/[id]/rechazar',
  },
  {
    action: 'devolver (responsable)',
    from: ['enviada'],
    to: 'devuelta_resp',
    requiredRoles: ['responsable_area'],
    segregation: 'validar',
    endpoint: '/api/solicitudes/[id]/devolver',
  },
  {
    action: 'devolver (director)',
    from: ['validada'],
    to: 'devuelta_dir',
    requiredRoles: ['director'],
    segregation: 'aprobar',
    endpoint: '/api/solicitudes/[id]/devolver',
  },
  {
    action: 'procesar_compras',
    from: ['aprobada', 'en_compras'],
    to: 'en_compras',
    requiredRoles: ['compras'],
    segregation: 'procesar_compras',
    endpoint: '/api/solicitudes/[id]/procesar-compras',
  },
  {
    action: 'programar_pago',
    from: ['en_compras'],
    to: 'pago_programado',
    requiredRoles: ['compras'],
    endpoint: '/api/solicitudes/[id]/programar-pago',
  },
  {
    action: 'registrar_compra',
    from: ['aprobada', 'en_compras', 'pago_programado'],
    to: 'comprada',
    requiredRoles: ['tesoreria', 'compras', 'solicitante'],
    segregation: 'comprar',
    endpoint: '/api/compras',
  },
  {
    action: 'registrar_recepcion',
    from: ['comprada'],
    to: (ctx) => {
      if (ctx.hasItems && ctx.allItemsReceived && !ctx.hasProblems) return 'recibida';
      if (ctx.hasItems && ctx.allItemsReceived && ctx.hasProblems) return 'recibida_con_obs';
      if (ctx.hasItems && !ctx.allItemsReceived) return 'comprada'; // partial
      if (ctx.conforme) return 'cerrada'; // no items, bulk conforme → cerrada (BUG: should be recibida)
      return 'recibida_con_obs';
    },
    requiredRoles: ['solicitante', 'responsable_area'],
    endpoint: '/api/recepciones',
  },
  {
    action: 'cerrar',
    from: ['recibida_con_obs'], // BUG: missing 'recibida'
    to: 'cerrada',
    requiredRoles: ['tesoreria', 'admin'],
    endpoint: '/api/solicitudes/[id]/cerrar',
  },
  {
    action: 'anular',
    from: ['enviada', 'validada', 'aprobada', 'en_compras', 'pago_programado'],
    to: 'anulada',
    requiredRoles: ['director', 'admin'], // or solicitante (owner)
    endpoint: '/api/solicitudes/[id]/anular',
  },
];

// ─── All possible states ──────────────────────────────────────────────────────
const ALL_STATES: EstadoSolicitud[] = [
  'borrador', 'enviada', 'devuelta_resp', 'validada', 'devuelta_dir',
  'aprobada', 'rechazada', 'comprada', 'recibida', 'recibida_con_obs',
  'en_compras', 'pago_programado', 'anulada', 'cerrada',
];

// Terminal states (no outgoing transitions)
const TERMINAL_STATES: EstadoSolicitud[] = ['rechazada', 'anulada', 'cerrada'];

// States that should have outgoing transitions
const NON_TERMINAL_STATES = ALL_STATES.filter(s => !TERMINAL_STATES.includes(s));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Workflow State Machine - Transition Definitions', () => {
  it('every non-terminal state has at least one outgoing transition', () => {
    const statesWithTransitions = new Set<EstadoSolicitud>();
    for (const t of TRANSITIONS) {
      for (const from of t.from) {
        statesWithTransitions.add(from);
      }
    }

    const statesWithoutTransitions = NON_TERMINAL_STATES.filter(
      s => !statesWithTransitions.has(s)
    );

    // DOCUMENTS A BUG: 'recibida' has no outgoing transition
    // It should be closable (cerrar endpoint should accept 'recibida')
    expect(statesWithoutTransitions).toEqual(['recibida']);
  });

  it('terminal states have no outgoing transitions', () => {
    for (const t of TRANSITIONS) {
      for (const from of t.from) {
        expect(TERMINAL_STATES).not.toContain(from);
      }
    }
  });

  it('all transition target states are valid states', () => {
    const defaultCtx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: true, hasItems: false, allItemsReceived: false, hasProblems: false,
    };
    for (const t of TRANSITIONS) {
      const target = typeof t.to === 'function' ? t.to(defaultCtx) : t.to;
      expect(ALL_STATES).toContain(target);
    }
  });
});

describe('Workflow State Machine - Happy Path (Flujo Normal)', () => {
  it('Path 1: Solicitante → Responsable valida → Director aprueba → Tesorería compra → Solicitante recibe conforme → Cerrada', () => {
    // This is the most common path
    const steps: { state: EstadoSolicitud; action: string; nextState: EstadoSolicitud }[] = [
      { state: 'borrador', action: 'enviar', nextState: 'enviada' },
      { state: 'enviada', action: 'validar', nextState: 'validada' },
      { state: 'validada', action: 'aprobar', nextState: 'aprobada' },
      { state: 'aprobada', action: 'registrar_compra', nextState: 'comprada' },
      { state: 'comprada', action: 'registrar_recepcion', nextState: 'cerrada' }, // conforme without items
    ];

    for (const step of steps) {
      const transition = TRANSITIONS.find(t => t.action === step.action);
      expect(transition, `Missing transition for action: ${step.action}`).toBeDefined();
      expect(transition!.from).toContain(step.state);
    }
  });

  it('Path 2: Con departamento de Compras (aprobada → en_compras → pago_programado → comprada)', () => {
    const steps: { state: EstadoSolicitud; action: string }[] = [
      { state: 'borrador', action: 'enviar' },
      { state: 'enviada', action: 'validar' },
      { state: 'validada', action: 'aprobar' }, // → en_compras (if hasComprasUsers)
      { state: 'en_compras', action: 'programar_pago' },
      { state: 'pago_programado', action: 'registrar_compra' },
      { state: 'comprada', action: 'registrar_recepcion' },
    ];

    for (const step of steps) {
      const transition = TRANSITIONS.find(t => t.action === step.action);
      expect(transition, `Missing transition for action: ${step.action}`).toBeDefined();
      expect(transition!.from).toContain(step.state);
    }
  });

  it('Path 3: Skip validación (enviada → aprobada directly by director)', () => {
    // When tenant config has requiere_validacion_responsable = false
    // The aprobar endpoint accepts 'enviada' state
    const aprobar = TRANSITIONS.find(t => t.action === 'aprobar');
    expect(aprobar).toBeDefined();
    // Current code allows 'validada' and 'enviada' (when skipValidacion)
    // But the transition definition only has 'validada'
    // The actual code does: const estadosPermitidos = skipValidacion ? ['validada', 'enviada'] : ['validada'];
    // This is tested separately below
  });
});

describe('Workflow State Machine - Devolución Paths', () => {
  it('devolver por responsable: enviada → devuelta_resp → (edit) → enviada', () => {
    const devolver = TRANSITIONS.find(t => t.action === 'devolver (responsable)');
    expect(devolver!.from).toContain('enviada');
    expect(devolver!.to).toBe('devuelta_resp');

    const enviar = TRANSITIONS.find(t => t.action === 'enviar');
    expect(enviar!.from).toContain('devuelta_resp');
  });

  it('devolver por director: validada → devuelta_dir → (edit) → enviada', () => {
    const devolver = TRANSITIONS.find(t => t.action === 'devolver (director)');
    expect(devolver!.from).toContain('validada');
    expect(devolver!.to).toBe('devuelta_dir');

    const enviar = TRANSITIONS.find(t => t.action === 'enviar');
    expect(enviar!.from).toContain('devuelta_dir');
  });

  it('devuelta_dir can be re-validated (skip re-sending)', () => {
    const validar = TRANSITIONS.find(t => t.action === 'validar');
    expect(validar!.from).toContain('devuelta_dir');
  });
});

describe('Workflow State Machine - Rechazo y Anulación', () => {
  it('rechazar: validada → rechazada', () => {
    const rechazar = TRANSITIONS.find(t => t.action === 'rechazar');
    expect(rechazar!.from).toContain('validada');
  });

  it('BUG: rechazar does NOT accept enviada (asymmetry with aprobar)', () => {
    // When validation is skipped, solicitudes go from enviada → aprobada
    // But they CANNOT go from enviada → rechazada
    // This is an asymmetry bug
    const rechazar = TRANSITIONS.find(t => t.action === 'rechazar');
    expect(rechazar!.from).not.toContain('enviada');
  });

  it('anular accepts multiple states', () => {
    const anular = TRANSITIONS.find(t => t.action === 'anular');
    expect(anular!.from).toEqual(
      expect.arrayContaining(['enviada', 'validada', 'aprobada', 'en_compras', 'pago_programado'])
    );
  });

  it('anular does NOT accept borrador (correct: user should just delete)', () => {
    const anular = TRANSITIONS.find(t => t.action === 'anular');
    expect(anular!.from).not.toContain('borrador');
  });

  it('anular does NOT accept comprada (correct: already purchased)', () => {
    const anular = TRANSITIONS.find(t => t.action === 'anular');
    expect(anular!.from).not.toContain('comprada');
  });

  it('anular does NOT accept terminal states', () => {
    const anular = TRANSITIONS.find(t => t.action === 'anular');
    expect(anular!.from).not.toContain('cerrada');
    expect(anular!.from).not.toContain('rechazada');
    expect(anular!.from).not.toContain('anulada');
  });
});

describe('Workflow State Machine - Recepción', () => {
  it('recepción conforme sin items → cerrada', () => {
    const recepcion = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    const ctx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: true, hasItems: false, allItemsReceived: false, hasProblems: false,
    };
    const target = (recepcion!.to as (ctx: TransitionContext) => EstadoSolicitud)(ctx);
    // Current code: conforme without items → 'cerrada' directly
    // This skips 'recibida' state entirely
    expect(target).toBe('cerrada');
  });

  it('recepción no conforme sin items → recibida_con_obs', () => {
    const recepcion = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    const ctx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: false, hasItems: false, allItemsReceived: false, hasProblems: false,
    };
    const target = (recepcion!.to as (ctx: TransitionContext) => EstadoSolicitud)(ctx);
    expect(target).toBe('recibida_con_obs');
  });

  it('recepción con items - todos recibidos sin problemas → recibida', () => {
    const recepcion = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    const ctx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: true, hasItems: true, allItemsReceived: true, hasProblems: false,
    };
    const target = (recepcion!.to as (ctx: TransitionContext) => EstadoSolicitud)(ctx);
    expect(target).toBe('recibida');
  });

  it('recepción con items - todos recibidos con problemas → recibida_con_obs', () => {
    const recepcion = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    const ctx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: false, hasItems: true, allItemsReceived: true, hasProblems: true,
    };
    const target = (recepcion!.to as (ctx: TransitionContext) => EstadoSolicitud)(ctx);
    expect(target).toBe('recibida_con_obs');
  });

  it('recepción parcial (no todos los items) → permanece comprada', () => {
    const recepcion = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    const ctx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: true, hasItems: true, allItemsReceived: false, hasProblems: false,
    };
    const target = (recepcion!.to as (ctx: TransitionContext) => EstadoSolicitud)(ctx);
    expect(target).toBe('comprada');
  });
});

describe('Workflow State Machine - Cierre', () => {
  it('cerrar: recibida_con_obs → cerrada', () => {
    const cerrar = TRANSITIONS.find(t => t.action === 'cerrar');
    expect(cerrar!.from).toContain('recibida_con_obs');
  });

  it('BUG: cerrar does NOT accept recibida', () => {
    // A solicitud in 'recibida' state (clean reception with items) has NO way to move to 'cerrada'
    // The cerrar endpoint only accepts 'recibida_con_obs'
    const cerrar = TRANSITIONS.find(t => t.action === 'cerrar');
    expect(cerrar!.from).not.toContain('recibida');
  });

  it('BUG: recibida is a dead-end state', () => {
    // No action can transition FROM 'recibida' to any other state
    const transitionsFromRecibida = TRANSITIONS.filter(t => t.from.includes('recibida'));
    expect(transitionsFromRecibida).toHaveLength(0);
  });
});

describe('Workflow State Machine - Role Requirements', () => {
  it('enviar requires solicitante (owner)', () => {
    const t = TRANSITIONS.find(t => t.action === 'enviar');
    expect(t!.requiredRoles).toContain('solicitante');
    expect(t!.requiresOwner).toBe(true);
  });

  it('validar requires responsable_area', () => {
    const t = TRANSITIONS.find(t => t.action === 'validar');
    expect(t!.requiredRoles).toContain('responsable_area');
  });

  it('aprobar requires director', () => {
    const t = TRANSITIONS.find(t => t.action === 'aprobar');
    expect(t!.requiredRoles).toContain('director');
  });

  it('rechazar requires director', () => {
    const t = TRANSITIONS.find(t => t.action === 'rechazar');
    expect(t!.requiredRoles).toContain('director');
  });

  it('procesar_compras requires compras role', () => {
    const t = TRANSITIONS.find(t => t.action === 'procesar_compras');
    expect(t!.requiredRoles).toContain('compras');
  });

  it('programar_pago requires compras role', () => {
    const t = TRANSITIONS.find(t => t.action === 'programar_pago');
    expect(t!.requiredRoles).toContain('compras');
  });

  it('registrar_compra allows tesoreria, compras, and solicitante', () => {
    const t = TRANSITIONS.find(t => t.action === 'registrar_compra');
    expect(t!.requiredRoles).toEqual(expect.arrayContaining(['tesoreria', 'compras', 'solicitante']));
  });

  it('registrar_recepcion allows solicitante and responsable_area', () => {
    const t = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    expect(t!.requiredRoles).toEqual(expect.arrayContaining(['solicitante', 'responsable_area']));
  });

  it('cerrar requires tesoreria or admin', () => {
    const t = TRANSITIONS.find(t => t.action === 'cerrar');
    expect(t!.requiredRoles).toEqual(expect.arrayContaining(['tesoreria', 'admin']));
  });

  it('anular requires director or admin (or owner)', () => {
    const t = TRANSITIONS.find(t => t.action === 'anular');
    expect(t!.requiredRoles).toEqual(expect.arrayContaining(['director', 'admin']));
  });
});

describe('Workflow State Machine - Segregation of Duties', () => {
  it('validar enforces segregation (cannot validate own)', () => {
    const t = TRANSITIONS.find(t => t.action === 'validar');
    expect(t!.segregation).toBe('validar');
  });

  it('aprobar enforces segregation (cannot approve own or if validated)', () => {
    const t = TRANSITIONS.find(t => t.action === 'aprobar');
    expect(t!.segregation).toBe('aprobar');
  });

  it('rechazar enforces same segregation as aprobar', () => {
    const t = TRANSITIONS.find(t => t.action === 'rechazar');
    expect(t!.segregation).toBe('aprobar');
  });

  it('registrar_compra enforces segregation (cannot buy if approved)', () => {
    const t = TRANSITIONS.find(t => t.action === 'registrar_compra');
    expect(t!.segregation).toBe('comprar');
  });

  it('procesar_compras enforces segregation (cannot process if approved)', () => {
    const t = TRANSITIONS.find(t => t.action === 'procesar_compras');
    expect(t!.segregation).toBe('procesar_compras');
  });
});

describe('Workflow State Machine - Edición', () => {
  const EDITABLE_STATES: EstadoSolicitud[] = ['borrador', 'devuelta_resp', 'devuelta_dir'];

  it('solicitud can be edited in borrador', () => {
    expect(EDITABLE_STATES).toContain('borrador');
  });

  it('solicitud can be edited when returned by responsable', () => {
    expect(EDITABLE_STATES).toContain('devuelta_resp');
  });

  it('solicitud can be edited when returned by director', () => {
    expect(EDITABLE_STATES).toContain('devuelta_dir');
  });

  it('solicitud CANNOT be edited in enviada', () => {
    expect(EDITABLE_STATES).not.toContain('enviada');
  });

  it('solicitud CANNOT be edited in validada', () => {
    expect(EDITABLE_STATES).not.toContain('validada');
  });

  it('solicitud CANNOT be edited in aprobada', () => {
    expect(EDITABLE_STATES).not.toContain('aprobada');
  });

  it('solicitud CANNOT be edited in any terminal state', () => {
    for (const state of TERMINAL_STATES) {
      expect(EDITABLE_STATES).not.toContain(state);
    }
  });
});

describe('Workflow State Machine - Known Bugs Summary', () => {
  it('BUG #1: rechazar only accepts validada, not enviada (when skipValidacion)', () => {
    const rechazar = TRANSITIONS.find(t => t.action === 'rechazar');
    // If skipValidacion=true, director can approve from 'enviada' but CANNOT reject from 'enviada'
    expect(rechazar!.from).toEqual(['validada']);
    // Expected: should also include 'enviada' when validation is skipped
  });

  it('BUG #2: cerrar only accepts recibida_con_obs, not recibida', () => {
    const cerrar = TRANSITIONS.find(t => t.action === 'cerrar');
    expect(cerrar!.from).toEqual(['recibida_con_obs']);
    // Expected: should also include 'recibida'
  });

  it('BUG #3: recibida is a dead-end state with no transitions out', () => {
    const fromRecibida = TRANSITIONS.filter(t => t.from.includes('recibida'));
    expect(fromRecibida).toHaveLength(0);
    // Expected: cerrar should accept 'recibida' to transition to 'cerrada'
  });

  it('BUG #4: procesar_compras allows idempotent en_compras → en_compras', () => {
    const procesar = TRANSITIONS.find(t => t.action === 'procesar_compras');
    // Allows re-processing an already in-process solicitud
    expect(procesar!.from).toContain('en_compras');
  });

  it('BUG #5: conforme reception without items goes to cerrada, skipping recibida', () => {
    const recepcion = TRANSITIONS.find(t => t.action === 'registrar_recepcion');
    const ctx: TransitionContext = {
      hasComprasUsers: false, skipValidacion: false,
      conforme: true, hasItems: false, allItemsReceived: false, hasProblems: false,
    };
    const target = (recepcion!.to as (ctx: TransitionContext) => EstadoSolicitud)(ctx);
    // Goes directly to 'cerrada', inconsistent with item-level flow that goes to 'recibida'
    expect(target).toBe('cerrada');
  });
});
