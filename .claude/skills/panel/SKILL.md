---
name: panel
description: Analiza una idea, decisión o proyecto con cuatro voces en conflicto (Inversionista, Distribución, Pre-mortem, Operador) y elige cuál gana. Usar cuando el usuario escriba /panel, pida "pensar como inversor", un pre-mortem, abogado del diablo, o evaluar una idea desde varias perspectivas.
argument-hint: <idea o decisión a evaluar>
---

# Panel de cuatro voces

Evaluá lo que el usuario pasa como argumento (`$ARGUMENTS`). Si no pasó nada,
usá la idea o decisión más reciente de la conversación. Si no hay ninguna,
preguntá cuál es en una línea.

Son cuatro voces en conflicto, no cuatro versiones tuyas.

## Reglas

- Cada voz optimiza algo distinto y sacrifica algo distinto. Nombrá qué sacrifica.
- Tienen que contradecirse en al menos un punto concreto. Si coinciden en todo,
  no pensaste: volvé a escribir.
- Cada afirmación lleva una etiqueta: **[Seguro]**, **[Probable]** o **[Suposición]**.
- Máximo 4 líneas por voz. Sin preámbulo: arrancá directo con la primera voz.
- Si el repo o la conversación tienen datos reales (usuarios, métricas, stack,
  quién mantiene el proyecto), usalos en vez de inventar. Lo inventado va como
  [Suposición].

## Las voces

1. **INVERSIONISTA**: solo le importa por qué esto, por qué ahora y por qué vos.
   Pregunta por el costo de oportunidad y por qué nadie más lo hizo ya. No le
   importa si la idea es "linda".

2. **DISTRIBUCIÓN**: no discute si el producto es bueno. Pregunta quién se
   entera, por qué canal y por qué dejaría lo que ya usa. No le importa la
   calidad técnica.

3. **PRE-MORTEM**: da por hecho que ya fracasó, 18 meses después. Escribe la
   causa de muerte más probable, no la más dramática. Prohibido decir "podría
   fallar": decí qué falló exactamente.

4. **OPERADOR**: pregunta quién hace el trabajo el martes a las 9am, con qué
   recursos, y qué pasa cuando esa persona se enferma. No le importa la estrategia.

## Formato de salida

```
**1. INVERSIONISTA** (sacrifica: …)
…

**2. DISTRIBUCIÓN** (sacrifica: …)
…

**3. PRE-MORTEM** (sacrifica: …)
…

**4. OPERADOR** (sacrifica: …)
…

**Qué voz gana esta vez y por qué**
<una sola voz, elegida, con el motivo>

**Dato que cambiaría el veredicto:** <un dato específico y medible>
```

El cierre es obligatorio: hay que elegir una sola voz (sin empates) y nombrar
un dato concreto que se pueda conseguir, no "más información".
