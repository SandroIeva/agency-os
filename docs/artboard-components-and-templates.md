# Komponenten, Vorlagen und Brand-Anwendung auf Artboards

Stand: 2026-09-14 · Planung, noch nichts davon gebaut

Das Ziel in einem Satz: fertige Vorlagen anbieten, die jemand auf die eigene
Brand umstellen kann, aus Bausteinen, die man selbst anlegt und wiederverwendet.

Dieses Dokument legt die Reihenfolge fest und begründet sie. Die Begründung ist
wichtiger als die Reihenfolge, weil eine Vorlage ohne die dritte Stufe nur ein
Artboard ist, das man kopiert.

## Was es schon gibt

| Sache | Wo | Zustand |
|---|---|---|
| Artboard-Dokument | `brand_canvases.doc` jsonb, `{ boards, stage }` | ein Dokument, mehrere Boards nebeneinander |
| Item | flache Liste je Board | `id`, `type`, `x/y/w/h`, Stil; Beziehungen über ids |
| Gruppe | `groupId` auf jedem Mitglied | **eine Ebene**, kein Baum. `groupSel` schluckt fremde Gruppen |
| Maske | `isMask` + `maskId` + gemeinsame `groupId` | CSS `clip-path`, nur Rechteck, Ellipse, Polygon |
| Vorlage | `brand_canvases.is_template` | Schalter, Filter in Creations, Eintrag "Aus Vorlage" im Neu-Menü |
| "Komponenten" im Panel | `CANVAS_COMPONENTS` | **Stempel**, keine Komponenten: eine `build()`-Funktion wirft lose Items aufs Board |
| Brand-Daten | `brand_profile` | `color_palette` (primary/secondary/accents), `colors`, `logos`, `logo_url`, `typography`, `gradients` |
| Brand im Editor | Prop `brand` | Farbwähler zeigt Brand-Farben und Brand-Verläufe bereits an |

Zwei Dinge daraus sind für alles Weitere entscheidend:

1. **Ein Item wird dreimal gezeichnet.** Der Editor, `CanvasThumb` (jede
   Vorschau, jede Karte) und `renderPostArtboard` (PNG und PDF) zeichnen
   dasselbe Board. Alle drei bekommen eine `items`-Liste. Dieselbe Falle ist für
   Ring-Text und für Masken schon zweimal zugeschlagen und steht in CLAUDE.md.
2. **Der Wortname ist belegt.** Was im Panel "Komponenten" heißt, sind Stempel.
   Die heißen künftig **Bausteine** / **Blocks**, damit "Komponente" das meint,
   was Leute darunter verstehen.

## Der Grundsatz: erweitern statt ein viertes Mal zeichnen

Eine Instanz ist **kein neuer Zeichentyp**. Sie wird vor dem Zeichnen aufgelöst.

```
canvasExpand(items, components) -> items      // eine reine Funktion, Modul-Ebene
```

Alles, was zeichnet, ruft sie oben einmal auf und malt danach ganz normale
Items. Alles, was **bearbeitet**, arbeitet weiter auf der nicht aufgelösten
Liste, in der eine Instanz genau ein Objekt ist, das man schiebt, dreht und
löscht.

Das ist derselbe Bau wie `canvasArcLayout` und `canvasMaskClip`: eine Stelle
entscheidet, drei Stellen sind sich einig. Ein vierter Zeichner, der die
Auflösung noch einmal nachbaut, ist die Art von Fehler, die erst im Export
auffällt.

## Stufe 1 · Komponenten im Dokument

### Die Definition liegt im Dokument

```js
doc.components = {
  "<cid>": {
    id: "<cid>",
    name: "Logo-Lockup",
    w, h,                    // die eigene Box der Definition
    items: [ … ],            // gewöhnliche Items, Koordinaten relativ zur eigenen Ecke
    libraryId, libraryVersion  // nur gesetzt, wenn aus der Bibliothek geholt (Stufe 2)
  }
}
```

Warum im Dokument und nicht in einer Tabelle: ein Artboard-Dokument ist **ein**
jsonb-Blob, und der Export, die Vorschau, die Versionen und das Teilen hängen
alle daran, dass es für sich allein vollständig ist. Läge die Definition
woanders, müsste eine Änderung daran in jedes Dokument nachgeschrieben werden,
das sie benutzt. Das ist ein Fan-out-Schreibvorgang über fremde Dateien, und
genau diese Klasse von Ferneingriff hat die Artboards schon einmal geleert
(siehe "Never sync an Artboard document live" in CLAUDE.md).

### Die Instanz ist ein gewöhnliches Item

```js
{ id, type: "instance", componentId, x, y, w, h, rot, opacity,
  overrides: { "<itemIdInDerDefinition>": { text, src } } }
```

`w/h` dürfen von der Definition abweichen, die Auflösung skaliert entsprechend.

### Was `canvasExpand` leisten muss

- Ein Nicht-Instanz-Item geht unverändert durch.
- Eine Instanz wird durch die Items ihrer Definition ersetzt, jedes davon mit
  - einer **berechenbaren** id (`"<instanzId>:<defItemId>"`), damit React-Keys
    stabil bleiben und ein Klick auf die Instanz zurückgerechnet werden kann,
  - Koordinaten um `x/y` verschoben und um `w/defW`, `h/defH` skaliert,
  - `groupId` im selben Namensraum,
  - **`maskId` durch dieselbe Abbildung geschickt.** Wird das vergessen, zeigt
    eine zweite Instanz auf die Maske der ersten. Genau dieser Fehler steckt
    schon in `placeFigmaItems` und ist dort kommentiert,
  - angewendeten Overrides,
  - einer Markierung `fromInstance`, damit Treffererkennung und Ebenenliste den
    Klick auf die Instanz falten.
- Verschachtelung wird aufgelöst, mit Tiefenbegrenzung und Zyklusschutz. Eine
  Komponente, die sich selbst enthält, muss beim Anlegen abgelehnt werden.

Dazu ein Test nach dem Muster von `scripts/test-canvas-mask-box.mjs`: die
Funktion aus `App.jsx` herausziehen und gegen den ausgelieferten Code prüfen,
mit einem Fall je Falle (Skalierung, Maske, Verschachtelung, Zyklus).

### Anlegen

Auswahl, dann "Komponente erstellen" im selben Kontextmenü, in dem Gruppieren
und Maskieren schon stehen. Die Auswahl wird an Ort und Stelle durch die Instanz
ersetzt, auf dem Bildschirm bewegt sich nichts.

### Bearbeiten: hineingehen, nicht woanders öffnen

Doppelklick geht in die Komponente hinein, genau die Geste, mit der man heute in
eine Gruppe hineingeht. Der Rest des Boards wird abgedunkelt und nimmt keine
Klicks mehr an. Oben steht ein Pfad, `Artboard 1 / Logo-Lockup`, und der erste
Teil führt zurück. Escape ebenso. Beim Verlassen zeichnen sich alle anderen
Instanzen neu.

Zustand dafür: `editingComponent = { cid, instanceId }`. Solange gesetzt,
schreiben Änderungen nach `doc.components[cid].items` statt ins Board.

Eine Vereinfachung, die das Ganze erst handhabbar macht: **wer drin ist, sieht
die Komponente unskaliert und ungedreht.** Sonst müsste jede Bearbeitung durch
die Transformation der Instanz zurückgerechnet werden, und das Ergebnis ist bei
Drehung nicht eindeutig.

Kein zweites Artboard, kein zweites Fenster. Ein neues Artboard würde die
Umgebung wegnehmen, für die man die Komponente überhaupt baut: Format,
Hintergrund und das, was rundherum liegt.

### Overrides: zuerst nur Text und Bild

Ein Text in der Definition lässt sich je Instanz überschreiben, ein Bild
austauschen. Alles andere folgt der Definition. Das deckt den Fall ab, für den
Komponenten gemacht sind, und hält die Daten klein. Ein vollständiges
Override-Modell über jede Eigenschaft ist der Punkt, an dem Komponentensysteme
unbenutzbar werden.

### Lösen

"Instanz lösen" ersetzt die Instanz durch ihre aufgelösten Items mit frischen
ids. Mit `canvasExpand` ist das eine Zeile.

### Leicht zu übersehen

`takeSnap` / `pushUndo` sichern heute nur `items`. Sobald Definitionen im
Dokument liegen, müssen sie **mit gesichert werden**, sonst lässt sich eine
Änderung innerhalb einer Komponente nicht rückgängig machen.

## Stufe 2 · Bibliothek

Erst wenn Stufe 1 steht, denn sie ist nur der Weg, eine Definition von einem
Dokument ins nächste zu bringen.

Tabelle `brand_components`: `id, org_id, project_id, name, w, h, items jsonb,
thumb_url, version int, visibility, created_by, created_at, updated_at`. RLS wie
bei `brand_canvases`.

Eine Komponente aus der Bibliothek zu setzen **kopiert** die Definition ins
Dokument und merkt sich `libraryId` und `libraryVersion`. Ist die Bibliothek
weiter, zeigt die Instanz das leise an und bietet "Aktualisieren". Nie ein
stilles Nachschreiben in fremde Dokumente. Das ist dasselbe Verhalten, das
Figma für veröffentlichte Bibliotheken hat, und es fällt mit der Entscheidung
aus Stufe 1 zusammen.

## Stufe 3 · Brand-Bindung, der eigentliche Schlüssel

**Ohne diese Stufe ist eine Vorlage nur ein Artboard zum Kopieren.** Die Farbe
eines Items ist heute ein fester Hex-Wert, und aus `#E60023` lässt sich nicht
ableiten, dass das die Primärfarbe sein sollte.

Also bekommt jedes betroffene Feld einen optionalen Nachbarn, der den festen
Wert nicht ersetzt, sondern erklärt:

| fester Wert | Nachbar | Werte |
|---|---|---|
| `fill` | `fillToken` | `primary`, `secondary`, `accent1…n`, `bg`, `text` |
| `color` (Text) | `colorToken` | dieselben |
| `src` (Bild) | `slot` | `logo` |
| `font` | `fontToken` | `heading`, `body` |

Der feste Wert bleibt das, was alle drei Zeichner lesen. Es ändert sich also
nichts an der Darstellung, und jedes bestehende Artboard bleibt gültig.

```
canvasApplyBrand(doc, brand) -> doc     // schreibt die festen Werte aus den Tokens
```

Angewendet wird **einmal, auf eine Kopie**, im Moment, in dem jemand eine
Vorlage nimmt. Keine lebende Bindung: sonst ändern sich alle Artboards still,
sobald jemand die Palette anfasst.

Im Editor genügt dafür eine kleine Zeile in der Seitenspalte: für das gewählte
Item "an Brand binden → Primär". Das schreibt nur den Token neben den festen
Wert.

## Stufe 4 · Vorlagen

Die Hälfte steht schon. Es fehlt:

- **"Vorlage anwenden"**: das Dokument der Vorlage in ein neues Canvas kopieren,
  dann `canvasApplyBrand` mit der Brand des Workspace.
- Eine Vorschau des Ergebnisses, bevor etwas angelegt wird.
- Der Hinweis im Panel, dass es noch keine Vorlagen gibt, darf dann weg.

## Stufe 5 · Vorlagen-Sets

Mehrere Vorlagen, die zusammen eine Brand tragen, damit man zu einer Vorlage
passende findet.

`brand_template_sets` (`id, org_id, name, description, cover_url`) und ein
`set_id` auf `brand_canvases`. Eine Vorlage gehört zu höchstens einem Set, was
genau das ist, was ein Set bedeutet, und "mehr aus diesem Set" ist eine Abfrage.

## Reihenfolge und warum

1. `canvasExpand` samt Test, ohne jede Oberfläche. Die Auflösung ist das Stück,
   an dem alles andere hängt, und sie lässt sich allein prüfen.
2. Anlegen, Instanz, Hineingehen, Lösen.
3. Overrides für Text und Bild.
4. Bibliothek.
5. Brand-Tokens und `canvasApplyBrand`.
6. Vorlage anwenden.
7. Sets.

Die Brand-Tokens könnten auch vor der Bibliothek kommen. Sie stehen hier
dahinter, weil eine Vorlage aus Komponenten besteht und eine Komponente, die
ihre Farben schon als Token trägt, die Vorlage geschenkt mitbringt.

## Offene Punkte

- **Figma-Import**: Figma kennt Komponenten, der Import macht daraus heute lose
  Items und schreibt eine Notiz `component`. Sobald Stufe 1 steht, kann er
  stattdessen Definitionen und Instanzen anlegen.
- **Verschachtelte Gruppen**: Gruppen sind eine Ebene tief. Eine Komponente ist
  faktisch die zweite Ebene, aber über einen anderen Weg, und sie bringt keinen
  Baum in die Gruppenlogik. Das soll so bleiben.
- **Instanz mit Drehung**: beim Hineingehen unskaliert und ungedreht, siehe
  oben. Ob das reicht, zeigt sich am ersten echten Einsatz.
