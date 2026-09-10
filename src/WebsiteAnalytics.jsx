const panel = { background: '#17171f', border: '1px solid rgba(255,255,255,.09)', borderRadius: 14, padding: 18 };
const dim = '#ffffff8A';
const number = value => Number(value || 0).toLocaleString('de-DE');
const regions = new Intl.DisplayNames(['de'], { type: 'region' });
function Ranking({ title, rows, pages = false, countries = false }) {
  return <div style={panel}><h3 style={{ fontSize: 13, margin: '0 0 14px' }}>{title}</h3>
    {!rows.length ? <p style={{ color: dim, fontSize: 12 }}>Noch keine Daten.</p> : rows.map(row => (
      <div key={row.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '7px 0', borderBottom: '1px solid #ffffff0d' }}>
        <span style={{ overflowWrap: 'anywhere', color: dim }}>{countries ? (row.name === 'ZZ' ? 'Unbekannt' : regions.of(row.name)) : row.name}</span>
        <span>{number(pages ? row.pageviews : row.visitors)}</span>
      </div>
    ))}
  </div>;
}
export default function WebsiteAnalytics({ data }) {
  return <section style={{ marginBottom: 30 }} aria-label="Website-Statistik">
    <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Marketing-Website</h2>
    {!data || data.error ? <div style={{ ...panel, color: dim, fontSize: 13 }}>Website-Statistik ist momentan nicht verfügbar. Einrichtung und Verbindung prüfen.</div> : <>
      <p style={{ color: dim, fontSize: 12, lineHeight: 1.6, margin: '0 0 16px' }}>Geschätzte Besucher: pro IP-Adresse und Kalendertag einmal gezählt. 7 und 30 Tage sind die Summe der Tageswerte; wiederkehrende Personen zählen an mehreren Tagen. Zeitzone: Berlin.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        {[['Besucher heute', data.today], ['Besuchertage · 7 Tage', data.days7], ['Besuchertage · 30 Tage', data.days30], ['Seitenaufrufe · 30 Tage', data.pageviews]].map(([label, value]) => <div key={label} style={panel}>
          <div style={{ fontSize: 11, color: dim }}>{label}</div><div style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{number(value)}</div>
        </div>)}
      </div>
      <div style={{ ...panel, marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, margin: '0 0 16px' }}>Besucher pro Tag · letzte 30 Tage</h3>
        {data.days30 === 0 && <p style={{ color: dim, fontSize: 12 }}>Noch keine Besuche erfasst. Die Zählung beginnt nach Veröffentlichung.</p>}
        <div style={{ display: 'flex', alignItems: 'end', height: 100, gap: 4 }} role="img" aria-label={data.daily.map(d => `${d.day}: ${d.visitors} Besucher`).join('; ')}>
          {data.daily.map(day => <div key={day.day} title={`${day.day}: ${number(day.visitors)} Besucher · ${number(day.pageviews)} Aufrufe`} style={{ flex: 1, height: `${Math.max(2, day.visitors / Math.max(1, ...data.daily.map(d => d.visitors)) * 100)}%`, background: day.visitors ? '#a9a2ff' : '#ffffff12', borderRadius: '3px 3px 0 0' }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: dim, marginTop: 8 }}><span>{data.daily[0]?.day}</span><span>Heute</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <Ranking title="Länder · Besuchertage (30 Tage)" rows={data.countries} countries />
        <Ranking title="Erste Zugriffsquelle · Besuchertage (30 Tage)" rows={data.sources} />
        <Ranking title="Seiten · Aufrufe (30 Tage)" rows={data.pages} pages />
      </div>
      <p style={{ fontSize: 11, color: dim, lineHeight: 1.6 }}>Länder sind ungefähr. Fehlende Referrer erscheinen als „Direkt / unbekannt“. Bekannte Bots und Browser mit Do Not Track werden ausgeschlossen. Sehr schnelle Wiederholungen werden zusammengefasst.</p>
    </>}
  </section>;
}
