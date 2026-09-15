# Vier Abschnitte für i7os.com/privacy (TikTok)

Die Datenschutzerklärung nennt Meta 16 Mal, Instagram 9 Mal, Threads 7 Mal und
**TikTok kein einziges Mal**. Genau diese Lücke gab es bei Meta auch, und sie ist
ein Ablehnungsgrund: TikTok prüft, ob die Erklärung abdeckt, was über ihre
Schnittstelle erhoben wird.

Die Seite ist auf Englisch, mit einer deutschen Fassung unter `/de/privacy`.
Unten steht die englische; die deutsche ist eine Übersetzung davon, keine
eigene Aussage.

**Nichts hiervon ist aus einer Vorlage.** Jeder Satz beschreibt, was
`api/tiktok.js` und der Composer tatsächlich tun.

Drei Dinge unterscheiden TikTok von Meta, und sie stehen deshalb ausdrücklich
drin:

1. **Ein Video geht nicht durch unseren Server.** TikTok nennt eine
   Upload-Adresse und der Browser legt die Bytes direkt dort ab. Das ist
   datenschutzrechtlich eine andere Aussage als bei Meta, wo wir einen Link
   liefern, den Meta abholt.
2. **Fotos holt TikTok über unsere Domain.** Sie werden nur von einer bei TikTok
   bestätigten Domain gezogen, also laufen sie über `app.i7os.com`.
3. **Es gibt keine Abmeldebenachrichtigung.** Meta ruft uns an, wenn jemand die
   App dort entfernt, und wir löschen daraufhin. TikTok tut das nicht. Wer die
   App nur bei TikTok entfernt, dessen Verbindung bleibt bei uns gespeichert,
   bis er in i7OS trennt oder schreibt. Das muss dastehen, sonst verspricht die
   Erklärung etwas, das der Code nicht hält.

---

## Neu unter „4. Data we process" · als 4.8

### 4.8 Connected social accounts (TikTok)

If you directly connect a TikTok account to i7OS, we store the information
needed to provide that connection:

- The access token issued by TikTok and its expiry date. TikTok access tokens
  are valid for 24 hours, so i7OS also stores the refresh token and its expiry
  date and renews the access token automatically while the connection exists.
- The account identifiers TikTok issues for your account in relation to i7OS
  (open ID and, where provided, union ID).
- The display name, username and profile picture URL of the connected account.
- The permissions the connection was granted, and which member of your
  workspace created it.

The connection belongs to the workspace, not to the person who created it, so
every member of that workspace can publish through it.

The direct integration does not import or retain your private messages,
follower lists or contacts from TikTok. Where you have granted the
corresponding permissions, account statistics and the numbers for your recent
posts are requested from TikTok when you open the relevant view and are not
retained in our database. Content you create or upload in i7OS is processed
separately as described in section 4.2.

Legal basis: performance of the contract, Article 6(1)(b) GDPR.

---

## Neu unter „6. Recipients and processors" · als 6.7

### 6.7 TikTok

When you use a direct TikTok connection to publish, i7OS sends the post text and
the settings you chose for it to TikTok Pte. Ltd. TikTok also receives the
access token and account identifiers needed to carry out the API request. The
settings sent are the visibility level you selected, whether comments, duets and
stitches are switched off, and whether you declared the post as commercial
content.

Media is transferred in one of two ways, depending on what you post:

- **Videos** are uploaded from your browser directly to the address TikTok
  provides for that post. The video file does not pass through our servers
  during this transfer.
- **Pictures** are retrieved by TikTok itself. TikTok only retrieves media from
  a domain verified in its developer portal, so i7OS provides the pictures
  through `app.i7os.com`, which reads them from our storage and passes them on.

TikTok returns the connection information described in section 4.8, the
publishing status of a post and, where you have granted the corresponding
permissions, account statistics and the numbers for your recent posts. TikTok
processes data it receives under its own
[Privacy Policy](https://www.tiktok.com/legal/page/eea/privacy-policy/en).
Media or posts TikTok has already received are not deleted by disconnecting.

---

## Neue Zeile in der Aufbewahrungstabelle unter „8. Retention"

| Data | Retention |
|---|---|
| Direct TikTok connections and access tokens | Until the connection is removed as described in section 8.2. Tokens are renewed automatically while connected; logging out of i7OS does not remove a workspace connection. |

---

## Neu unter „8.1" · als 8.2

### 8.2 Removing a TikTok connection

You can remove a direct TikTok connection and request deletion of its connection
data in either of these ways:

1. **In i7OS:** open **Settings → Account** in the relevant workspace and select
   **Disconnect** for TikTok. This removes that connection's database record,
   including its access token, refresh token and account information, when the
   disconnect request is processed.
2. **By writing to support@i7os.com** with the account name, if you no longer
   have access to i7OS. We delete within 30 days and confirm it.

Please note: removing i7OS from the connected apps in your TikTok account
settings stops i7OS from using the connection, because the tokens stop working.
TikTok does not notify us when you do this, so the connection record remains
stored in i7OS until you disconnect it there or contact us as described above.

Disconnecting removes the stored tokens, account identifiers, display name,
username and profile picture URL listed in section 4.8. It does not delete posts
already published on TikTok; you can delete those in the TikTok app. Files and
other content you created in i7OS remain subject to the retention rules above.
