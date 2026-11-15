---
name: frontend-structure
description: Controlla che il frontend di Careme (src/) rispetti la struttura e la separazione tra logica e presentazione definite in CLAUDE.md, e segnala il codice "spaghetti". Read-only. Usalo su un file, una cartella o le modifiche del branch.
---

# frontend-structure

Review read-only della struttura del frontend. Non modifica file, non installa pacchetti, non fa commit.

## Scope

- Se l'utente indica un file o una cartella, controlla quello.
- Altrimenti controlla i file modificati nel branch: `git diff main...HEAD --name-only -- src/`.

Leggi prima `CLAUDE.md` (sezioni Code quality e Working agreement) e `docs/architecture/frontend.md` e usa `Grep` per cercare i simboli prima di aprire i file. Leggi intervalli di righe, non interi file, quando possibile.

## Regole da controllare

### 1. Logica nel padre, presentazione nei figli

- **Hook dati e navigazione** (`useQuery`, `useMutation`, hook di dominio come `useProducts`, `useProduct`, `useDeleteProduct`, `useNavigate`, `useBlocker`, `useSubmit`, `useSessionRefresh`, ecc.) vanno solo in:
  - le pagine (`pages/XxxPage/XxxPage.tsx`),
  - i layout e le route (`routes/`),
  - gli hook (`hooks/useXxx/`).
- I componenti in `components/` e in `pages/*/components/` sono presentazionali: ricevono props, chiamano callback. Possono avere solo stato di UI (aperto/chiuso, focus, hover, valore di un campo prima del submit).
- Una deviazione va segnalata con `file:riga`. Non segnalare un hook di UI puro (es. `useId`, `useRef`, `useState` locale).

### 2. Accesso ai dati

- Le chiamate HTTP stanno in `lib/` (es. `productsApi.ts`) e vengono usate solo come `queryFn`/`mutationFn`.
- Nessun `fetch` in componenti, effect, handler o store.
- Nessun Supabase client in `src/`.

### 3. Niente spaghetti code

Segnala come **spaghetti** questi casi, con la gravità indicata:

- **Alta**: `useEffect` che sincronizza uno stato con un altro (va derivato durante il render); catene di effect che si attivano a vicenda; stato duplicato dello stesso dato (es. dato del server copiato in `useState`); dipendenze circolari tra moduli.
- **Media**: funzioni che fanno più cose insieme (validazione, chiamata, navigazione, UI nello stesso blocco); condizioni annidate su più livelli dentro il JSX; props passate attraverso più di due livelli di componenti senza che ci sia un motivo (valutare se conviene un hook o un contesto già esistente).
- **Bassa**: funzioni molto lunghe (indicativamente oltre 50 righe), nomi generici (`data`, `handle`, `temp`), file che superano la responsabilità del loro nome.

Non suggerire astrazioni nuove per "pulizia": CLAUDE.md chiede di estrarre logica al terzo ripetersi, non prima. Se una soluzione aggiunge file o livelli, dichiara il costo.

### 4. Form e modifiche non salvate

- Ogni form con input utente usa `useForm` per il dirty tracking.
- La chiusura usa `UnsavedChangesModal` condiviso; la navigazione usa `useUnsavedChangesGuard`; il `beforeunload` è registrato solo se il form è sporco.
- Segnala la reimplementazione di questi meccanismi in un singolo form.

### 5. Struttura dei file

- Pagina nuova: `pages/XxxPage/XxxPage.tsx` + `.module.css` + test, più una voce in `router.tsx` sotto la route protetta.
- Componente usato da una pagina: `pages/XxxPage/components/<Name>/`. Componente condiviso: `src/components/<Name>/`.
- Una cartella per componente e per hook; test accanto al file testato.
- Nessun file di componente che contiene più componenti esportati, salvo piccoli sotto-componenti privati.

## Cosa non fare

- Non correggere nulla. Riporta e basta.
- Non segnalare lo stile del codice che CLAUDE.md non regola (Prettier e ESLint lo coprono).
- Se trovi una violazione di una regola di CLAUDE.md o un rischio di sicurezza, dillo chiaramente e chiedi come procedere: non lavorarci intorno.

## Formato del report (in italiano)

Ordina per gravità: alta, media, bassa. Per ogni problema:

- **File**: `percorso:riga`
- **Regola**: quale punto sopra
- **Problema**: una o due frasi
- **Perché conta**: effetto concreto (re-render, bug, difficoltà di test, incoerenza)
- **Correzione proposta**: descritta, non applicata

Se non trovi nulla, dillo e elenca i controlli che hai eseguito.
