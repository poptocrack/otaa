import { useState, useEffect, useMemo } from 'react';
import { fetchUsers, fetchAllRuns, fetchEvents, fetchUserRuns, type UserProfile, type RunData, type EventData } from './firebase';

type Tab = 'overview' | 'progression' | 'gameplay' | 'users' | 'runs';

export function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userRuns, setUserRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchAllRuns(), fetchEvents()])
      .then(([u, r, e]) => { setUsers(u); setRuns(r); setEvents(e); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedUser) fetchUserRuns(selectedUser).then(setUserRuns);
  }, [selectedUser]);

  const analytics = useMemo(() => computeAnalytics(users, runs, events), [users, runs, events]);

  if (loading) return <div style={S.container}><p style={{ color: '#00ff00' }}>Loading...</p></div>;

  return (
    <div style={S.container}>
      <h1 style={S.title}>OTAA BACKOFFICE</h1>
      <div style={S.tabBar}>
        {(['overview', 'progression', 'gameplay', 'users', 'runs'] as Tab[]).map((t) => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab a={analytics} />}
      {tab === 'progression' && <ProgressionTab a={analytics} events={events} />}
      {tab === 'gameplay' && <GameplayTab a={analytics} />}
      {tab === 'users' && <UsersTab users={users} selectedUser={selectedUser} setSelectedUser={setSelectedUser} userRuns={userRuns} />}
      {tab === 'runs' && <RunsTab runs={runs} />}
    </div>
  );
}

// --- Analytics computation ---
interface Analytics {
  totalUsers: number;
  totalRuns: number;
  avgScore: number;
  avgWave: number;
  avgDuration: number;
  avgKillsPerRun: number;
  survivalRate: number;
  modeDistribution: Record<string, number>;
  weaponPopularity: Record<string, number>;
  weaponWinRate: Record<string, { total: number; wins: number }>;
  deathWaveDistribution: Record<number, number>;
  avgDeathWave: number;
  questsPerRun: number;
  chainDistribution: Record<number, number>;
  avgChainLength: number;
  biomeDistribution: Record<string, number>;
  runsBeforeFirstUnlock: number;
  weaponUnlockOrder: { weapon: string; avgRuns: number }[];
  usersWithMultipleWeapons: number;
  avgScrapPerRun: number;
  avgCoresPerRun: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
  avgRunsPerUser: number;
  usersByRunCount: Record<string, number>;
}

function computeAnalytics(users: UserProfile[], runs: RunData[], events: EventData[]): Analytics {
  const now = Date.now();
  const day = 86400000;

  const totalUsers = users.length;
  const totalRuns = runs.length;
  const avgScore = totalRuns ? Math.round(runs.reduce((s, r) => s + r.score, 0) / totalRuns) : 0;
  const avgWave = totalRuns ? +(runs.reduce((s, r) => s + r.wave, 0) / totalRuns).toFixed(1) : 0;
  const durRuns = runs.filter((r) => r.duration > 0);
  const avgDuration = durRuns.length ? Math.round(durRuns.reduce((s, r) => s + r.duration, 0) / durRuns.length) : 0;
  const avgKillsPerRun = totalRuns ? Math.round(runs.reduce((s, r) => s + r.kills, 0) / totalRuns) : 0;
  const survivalRate = totalRuns ? Math.round((runs.filter((r) => r.survived).length / totalRuns) * 100) : 0;

  // Mode distribution
  const modeDistribution: Record<string, number> = {};
  for (const r of runs) modeDistribution[r.mode] = (modeDistribution[r.mode] ?? 0) + 1;

  // Weapon popularity & win rate
  const weaponPopularity: Record<string, number> = {};
  const weaponWinRate: Record<string, { total: number; wins: number }> = {};
  for (const r of runs) {
    for (const w of r.equippedWeapons ?? []) {
      weaponPopularity[w] = (weaponPopularity[w] ?? 0) + 1;
      if (!weaponWinRate[w]) weaponWinRate[w] = { total: 0, wins: 0 };
      weaponWinRate[w].total++;
      if (r.survived) weaponWinRate[w].wins++;
    }
  }

  // Death wave distribution
  const deathWaveDistribution: Record<number, number> = {};
  const deathRuns = runs.filter((r) => !r.survived && r.deathWave);
  for (const r of deathRuns) deathWaveDistribution[r.deathWave!] = (deathWaveDistribution[r.deathWave!] ?? 0) + 1;
  const avgDeathWave = deathRuns.length ? +(deathRuns.reduce((s, r) => s + (r.deathWave ?? 0), 0) / deathRuns.length).toFixed(1) : 0;

  // Quests
  const questRuns = runs.filter((r) => r.questsCompleted != null);
  const questsPerRun = questRuns.length ? +(questRuns.reduce((s, r) => s + r.questsCompleted, 0) / questRuns.length).toFixed(1) : 0;

  // Chain distribution
  const chainDistribution: Record<number, number> = {};
  const chainRuns = runs.filter((r) => r.chainCount != null && r.chainCount > 0);
  for (const r of chainRuns) chainDistribution[r.chainCount!] = (chainDistribution[r.chainCount!] ?? 0) + 1;
  const avgChainLength = chainRuns.length ? +(chainRuns.reduce((s, r) => s + (r.chainCount ?? 0), 0) / chainRuns.length).toFixed(1) : 0;

  // Biome
  const biomeDistribution: Record<string, number> = {};
  for (const r of runs) if (r.hexBiome) biomeDistribution[r.hexBiome] = (biomeDistribution[r.hexBiome] ?? 0) + 1;

  // Weapon unlock funnel
  const unlockEvents = events.filter((e) => e.event === 'weapon_unlock');
  const runsBeforeFirstUnlock = unlockEvents.length
    ? Math.round(unlockEvents.reduce((s, e) => s + (e.totalRuns ?? 0), 0) / unlockEvents.length)
    : 0;

  const unlockByWeapon: Record<string, number[]> = {};
  for (const e of unlockEvents) {
    const wId = e.weaponId ?? 'unknown';
    if (!unlockByWeapon[wId]) unlockByWeapon[wId] = [];
    unlockByWeapon[wId].push(e.totalRuns ?? 0);
  }
  const weaponUnlockOrder = Object.entries(unlockByWeapon)
    .map(([weapon, runsArr]) => ({
      weapon,
      avgRuns: Math.round(runsArr.reduce((a, b) => a + b, 0) / runsArr.length),
    }))
    .sort((a, b) => a.avgRuns - b.avgRuns);

  const usersWithMultipleWeapons = users.filter((u) => (u.unlockedWeapons?.length ?? 0) > 1).length;

  // Economy
  const avgScrapPerRun = totalRuns ? Math.round(runs.reduce((s, r) => s + (r.scrapEarned ?? 0), 0) / totalRuns) : 0;
  const avgCoresPerRun = totalRuns ? +(runs.reduce((s, r) => s + (r.coresEarned ?? 0), 0) / totalRuns).toFixed(2) : 0;

  // Retention
  const activeUsersLast24h = users.filter((u) => u.lastSeen && (now - u.lastSeen.toDate().getTime()) < day).length;
  const activeUsersLast7d = users.filter((u) => u.lastSeen && (now - u.lastSeen.toDate().getTime()) < day * 7).length;
  const avgRunsPerUser = totalUsers ? +(users.reduce((s, u) => s + u.totalRuns, 0) / totalUsers).toFixed(1) : 0;

  const usersByRunCount: Record<string, number> = { '1': 0, '2-5': 0, '6-10': 0, '11-25': 0, '25+': 0 };
  for (const u of users) {
    const r = u.totalRuns;
    if (r <= 1) usersByRunCount['1']++;
    else if (r <= 5) usersByRunCount['2-5']++;
    else if (r <= 10) usersByRunCount['6-10']++;
    else if (r <= 25) usersByRunCount['11-25']++;
    else usersByRunCount['25+']++;
  }

  return {
    totalUsers, totalRuns, avgScore, avgWave, avgDuration, avgKillsPerRun, survivalRate,
    modeDistribution, weaponPopularity, weaponWinRate, deathWaveDistribution, avgDeathWave,
    questsPerRun, chainDistribution, avgChainLength, biomeDistribution,
    runsBeforeFirstUnlock, weaponUnlockOrder, usersWithMultipleWeapons,
    avgScrapPerRun, avgCoresPerRun, activeUsersLast24h, activeUsersLast7d,
    avgRunsPerUser, usersByRunCount,
  };
}

// --- Tabs ---
function OverviewTab({ a }: { a: Analytics }) {
  return (
    <div>
      <Section title="PLAYERS">
        <Grid>
          <Card label="TOTAL USERS" value={a.totalUsers} />
          <Card label="ACTIVE 24H" value={a.activeUsersLast24h} />
          <Card label="ACTIVE 7D" value={a.activeUsersLast7d} />
          <Card label="AVG RUNS/USER" value={a.avgRunsPerUser} />
        </Grid>
      </Section>

      <Section title="RETENTION (RUNS PER USER)">
        <Grid>
          {Object.entries(a.usersByRunCount).map(([bucket, count]) => (
            <Card key={bucket} label={`${bucket} RUNS`} value={count} />
          ))}
        </Grid>
      </Section>

      <Section title="RUNS">
        <Grid>
          <Card label="TOTAL RUNS" value={a.totalRuns} />
          <Card label="AVG SCORE" value={a.avgScore} />
          <Card label="AVG WAVE" value={a.avgWave} />
          <Card label="AVG DURATION" value={`${a.avgDuration}s`} />
          <Card label="AVG KILLS/RUN" value={a.avgKillsPerRun} />
          <Card label="SURVIVAL RATE" value={`${a.survivalRate}%`} />
        </Grid>
      </Section>

      <Section title="MODE DISTRIBUTION">
        <Grid>
          {Object.entries(a.modeDistribution).map(([mode, count]) => (
            <Card key={mode} label={mode.toUpperCase()} value={`${count} (${a.totalRuns ? Math.round(count / a.totalRuns * 100) : 0}%)`} />
          ))}
        </Grid>
      </Section>

      <Section title="ECONOMY">
        <Grid>
          <Card label="AVG SCRAP/RUN" value={a.avgScrapPerRun} color="#ffff00" />
          <Card label="AVG CORES/RUN" value={a.avgCoresPerRun} color="#00ffff" />
        </Grid>
      </Section>
    </div>
  );
}

function ProgressionTab({ a, events }: { a: Analytics; events: EventData[] }) {
  return (
    <div>
      <Section title="WEAPON UNLOCK FUNNEL">
        <Grid>
          <Card label="AVG RUNS BEFORE 1ST UNLOCK" value={a.runsBeforeFirstUnlock} />
          <Card label="USERS WITH 2+ WEAPONS" value={`${a.usersWithMultipleWeapons} / ${a.totalUsers}`} />
        </Grid>
        {a.weaponUnlockOrder.length > 0 && (
          <table style={S.table}>
            <thead><tr><th style={S.th}>WEAPON</th><th style={S.th}>AVG RUNS TO UNLOCK</th></tr></thead>
            <tbody>
              {a.weaponUnlockOrder.map((w) => (
                <tr key={w.weapon}><td style={S.td}>{w.weapon}</td><td style={S.td}>{w.avgRuns}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="DEATH WAVE DISTRIBUTION">
        <p style={S.hint}>Average death wave: {a.avgDeathWave}</p>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100, marginTop: 10 }}>
          {Object.entries(a.deathWaveDistribution).sort((a, b) => +a[0] - +b[0]).map(([wave, count]) => {
            const maxCount = Math.max(...Object.values(a.deathWaveDistribution));
            return (
              <div key={wave} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ background: '#00ff00', width: '80%', height: `${(count / maxCount) * 80}px`, minHeight: 2 }} />
                <span style={{ fontSize: 9, color: '#005500', marginTop: 4 }}>W{wave}</span>
                <span style={{ fontSize: 9, color: '#00ff00' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="TERRITORY CHAINS">
        <Grid>
          <Card label="AVG CHAIN LENGTH" value={a.avgChainLength} />
        </Grid>
        <Grid>
          {Object.entries(a.chainDistribution).sort((a, b) => +a[0] - +b[0]).map(([chain, count]) => (
            <Card key={chain} label={`CHAIN ${chain}`} value={count} />
          ))}
        </Grid>
      </Section>
    </div>
  );
}

function GameplayTab({ a }: { a: Analytics }) {
  return (
    <div>
      <Section title="WEAPON POPULARITY">
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>WEAPON</th><th style={S.th}>USAGE</th><th style={S.th}>WIN RATE</th></tr>
          </thead>
          <tbody>
            {Object.entries(a.weaponPopularity).sort((a, b) => b[1] - a[1]).map(([weapon, count]) => {
              const wr = a.weaponWinRate[weapon];
              const winRate = wr ? Math.round((wr.wins / wr.total) * 100) : 0;
              return (
                <tr key={weapon}>
                  <td style={S.td}>{weapon.toUpperCase()}</td>
                  <td style={S.td}>{count} ({a.totalRuns ? Math.round(count / a.totalRuns * 100) : 0}%)</td>
                  <td style={{ ...S.td, color: winRate > 50 ? '#00ff00' : '#ff3333' }}>{winRate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="QUESTS">
        <Grid>
          <Card label="AVG QUESTS/RUN" value={a.questsPerRun} />
        </Grid>
      </Section>

      <Section title="BIOME DISTRIBUTION (TERRITORY)">
        <Grid>
          {Object.entries(a.biomeDistribution).sort((a, b) => b[1] - a[1]).map(([biome, count]) => (
            <Card key={biome} label={biome.toUpperCase()} value={count} />
          ))}
        </Grid>
      </Section>
    </div>
  );
}

function UsersTab({ users, selectedUser, setSelectedUser, userRuns }: {
  users: UserProfile[]; selectedUser: string | null;
  setSelectedUser: (uid: string | null) => void; userRuns: RunData[];
}) {
  return (
    <div>
      <Section title={`USERS (${users.length})`}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>UID</th><th style={S.th}>RUNS</th><th style={S.th}>KILLS</th>
              <th style={S.th}>BEST W</th><th style={S.th}>BEST S</th><th style={S.th}>SCRAP</th>
              <th style={S.th}>CORES</th><th style={S.th}>HEXES</th><th style={S.th}>WEAPONS</th>
              <th style={S.th}>LAST SEEN</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} style={{ ...S.tr, ...(selectedUser === u.uid ? { background: '#003300' } : {}) }}
                onClick={() => setSelectedUser(u.uid)}>
                <td style={S.td}>{u.uid.slice(0, 10)}..</td>
                <td style={S.td}>{u.totalRuns}</td>
                <td style={S.td}>{u.totalKills}</td>
                <td style={S.td}>{u.bestWave}</td>
                <td style={S.td}>{u.bestScore}</td>
                <td style={S.tdY}>{u.scrap}</td>
                <td style={S.tdC}>{u.cores}</td>
                <td style={S.td}>{u.conqueredHexes}</td>
                <td style={S.td}>{u.unlockedWeapons?.length ?? 1}</td>
                <td style={S.td}>{u.lastSeen?.toDate?.()?.toLocaleDateString() ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {selectedUser && (
        <Section title={`RUNS — ${selectedUser.slice(0, 10)}..`}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>MODE</th><th style={S.th}>SCORE</th><th style={S.th}>WAVE</th>
                <th style={S.th}>KILLS</th><th style={S.th}>LVL</th><th style={S.th}>DUR</th>
                <th style={S.th}>SCRAP</th><th style={S.th}>OK</th><th style={S.th}>CHAIN</th>
                <th style={S.th}>QUEST</th><th style={S.th}>WEAPONS</th>
              </tr>
            </thead>
            <tbody>
              {userRuns.map((r, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{r.mode}</td>
                  <td style={S.td}>{r.score}</td>
                  <td style={S.td}>{r.wave}</td>
                  <td style={S.td}>{r.kills}</td>
                  <td style={S.td}>{r.level}</td>
                  <td style={S.td}>{r.duration ? `${r.duration}s` : '-'}</td>
                  <td style={S.tdY}>{r.scrapEarned}</td>
                  <td style={r.survived ? S.tdG : S.tdR}>{r.survived ? 'Y' : 'N'}</td>
                  <td style={S.td}>{r.chainCount ?? 0}</td>
                  <td style={S.td}>{r.questsCompleted ?? 0}</td>
                  <td style={S.td}>{r.equippedWeapons?.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function RunsTab({ runs }: { runs: RunData[] }) {
  return (
    <Section title={`RECENT RUNS (${runs.length})`}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>USER</th><th style={S.th}>MODE</th><th style={S.th}>SCORE</th>
            <th style={S.th}>WAVE</th><th style={S.th}>KILLS</th><th style={S.th}>DUR</th>
            <th style={S.th}>OK</th><th style={S.th}>DIFF</th><th style={S.th}>CHAIN</th>
            <th style={S.th}>WEAPONS</th><th style={S.th}>TIME</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} style={S.tr}>
              <td style={S.td}>{r.uid?.slice(0, 8)}..</td>
              <td style={S.td}>{r.mode}</td>
              <td style={S.td}>{r.score}</td>
              <td style={S.td}>{r.wave}</td>
              <td style={S.td}>{r.kills}</td>
              <td style={S.td}>{r.duration ? `${r.duration}s` : '-'}</td>
              <td style={r.survived ? S.tdG : S.tdR}>{r.survived ? 'Y' : 'N'}</td>
              <td style={S.td}>{r.hexDifficulty ?? '-'}</td>
              <td style={S.td}>{r.chainCount ?? 0}</td>
              <td style={S.td}>{r.equippedWeapons?.join(', ')}</td>
              <td style={S.td}>{r.timestamp?.toDate?.()?.toLocaleString() ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// --- Shared components ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 24 }}><h2 style={S.section}>{title}</h2>{children}</div>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={S.grid}>{children}</div>;
}
function Card({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={S.card}>
      <div style={{ ...S.cardValue, ...(color ? { color } : {}) }}>{value}</div>
      <div style={S.cardLabel}>{label}</div>
    </div>
  );
}

// --- Styles ---
const S: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1400, margin: '0 auto', padding: 20 },
  title: { fontSize: 24, letterSpacing: 6, marginBottom: 20, color: '#00ff00' },
  section: { fontSize: 14, letterSpacing: 3, marginBottom: 10, color: '#00ff00', borderBottom: '1px solid #002200', paddingBottom: 6 },
  hint: { fontSize: 11, color: '#005500' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 20 },
  tab: { padding: '8px 16px', background: 'transparent', border: '1px solid #002200', color: '#004400', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' },
  tabActive: { borderColor: '#00ff00', color: '#00ff00', background: '#001100' },
  grid: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 12 },
  card: { border: '1px solid #002200', padding: '10px 16px', minWidth: 120 },
  cardValue: { fontSize: 22, fontWeight: 'bold', color: '#00ff00' },
  cardLabel: { fontSize: 9, color: '#004400', letterSpacing: 2, marginTop: 3 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { textAlign: 'left' as const, padding: 6, borderBottom: '1px solid #002200', color: '#004400', fontSize: 10 },
  tr: { cursor: 'pointer' },
  td: { padding: 6, borderBottom: '1px solid #0a0a0a', color: '#00ff00' },
  tdY: { padding: 6, borderBottom: '1px solid #0a0a0a', color: '#ffff00' },
  tdC: { padding: 6, borderBottom: '1px solid #0a0a0a', color: '#00ffff' },
  tdG: { padding: 6, borderBottom: '1px solid #0a0a0a', color: '#00ff00' },
  tdR: { padding: 6, borderBottom: '1px solid #0a0a0a', color: '#ff3333' },
};
