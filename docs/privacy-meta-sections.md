# Zwei Abschnitte für i7os.com/privacy (Meta App Review)

Die Datenschutzerklärung nennt Meta, Instagram und Threads bisher nirgends. Für
das App Review fehlen zwei Dinge: **was** wir von einem verbundenen Meta-Konto
speichern, und **wie** man es löscht.

Der Löschabschnitt braucht eine Ankermarke, denn genau darauf zeigt in der
Meta-Konsole das Feld **User data deletion → Data deletion instructions URL**:

```
https://www.i7os.com/privacy#data-deletion
```

Beide Abschnitte sind unten so formuliert, wie die Seite heute klingt, und
beschreiben, was der Code wirklich tut. Nichts davon ist aus einer Vorlage.

---

## Neu unter „4. Data we process" · als 4.7

### 4.7 Connected social accounts (Meta)

If you connect an Instagram or Threads account, we store only what is needed to
act on that account on your behalf:

- the access token issued by Meta,
- the account id and account name (username),
- the account type and the token's expiry date,
- which member of your workspace created the connection.

We do **not** store your posts, your messages, your followers, your contacts or
any content from those accounts. Metrics we display (reach, interactions,
followers, the 24-hour publishing allowance) are fetched from Meta at the moment
you open the page and are not retained.

The connection belongs to the workspace, not to the person who made it, so every
member of that workspace can publish through it.

Legal basis: performance of the contract, Article 6(1)(b) GDPR.

---

## Neu unter „6. Recipients and processors" · als 6.6

### 6.6 Meta

Publishing to Instagram or Threads sends the content of that post, and the
picture or video belonging to it, to Meta Platforms Ireland Limited. Media held
in our own storage is handed over as a temporary link that Meta fetches itself
and that expires after one hour.

We receive from Meta only the account name, the account id and the metrics for
that account. Nothing is passed on to third parties.

---

## Neu als eigener Abschnitt mit Ankermarke `data-deletion`

Am besten direkt nach „8. Retention".

### Deleting connected account data {#data-deletion}

You can remove a connected Instagram or Threads account at any time, in three
ways, and each of them deletes the record completely and immediately:

1. In i7OS: **Settings → Account**, then **Disconnect** on Instagram or Threads.
2. In Instagram or Threads: remove i7OS under the app's own settings for
   websites and apps. Meta notifies us and we delete the record.
3. By writing to support@i7os.com with the account name, if you no longer have
   access to i7OS. We delete within 30 days and confirm it.

Deleting a connection removes the access token, the account id and the account
name. Posts already published stay on Instagram or Threads, because they belong
to your account there and not to us; delete them in the respective app.

Deleting your i7OS account, as described under Retention, deletes every
connected account with it.

---

### Hinweis an den Agenten

`{#data-deletion}` ist die Schreibweise für eine Ankermarke in Markdown-nahen
Systemen. Falls die Seite anders gebaut ist, genügt jede Überschrift, deren
`id` `data-deletion` lautet. Entscheidend ist nur, dass
`https://www.i7os.com/privacy#data-deletion` an dieser Stelle landet.
