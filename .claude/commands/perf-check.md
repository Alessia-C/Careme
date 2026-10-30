---
description: Controllo delle prestazioni del frontend sulle modifiche del branch o su un file indicato
argument-hint: [file o pagina, facoltativo]
---

Usa l'agent frontend-performance-auditor per controllare le prestazioni di $ARGUMENTS.
Se l'argomento è vuoto, controlla le modifiche a src/ del branch rispetto a main.
Misura il bundle con `npm run build` e riporta le misure prima dei problemi.
Riporta i problemi in italiano, senza correggerli.
