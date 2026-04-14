import { useState, useEffect, useMemo } from 'react';
import { fetchUsers, fetchAllRuns, fetchEvents, fetchUserRuns, signInAdmin, onAuthChange, type UserProfile, type RunData, type EventData } from './firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { User } from 'firebase/auth';

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      await signInAdmin(email, password);
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center">
      <Card className="w-80">
        <CardContent className="pt-6 space-y-4">
          <h1 className="text-xl font-bold text-center">OTAA Backoffice</h1>
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-secondary text-foreground border border-border rounded-md text-sm"
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-3 py-2 bg-secondary text-foreground border border-border rounded-md text-sm"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button className="w-full" onClick={handleLogin}>Sign In</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthChange((u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) return (
    <div className="dark min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );

  if (!authUser) return <LoginScreen />;

  return <Dashboard />;
}

function Dashboard() {
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

  const a = useMemo(() => computeAnalytics(users, runs, events), [users, runs, events]);

  if (loading) return (
    <div className="dark min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading data...</p>
    </div>
  );

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold tracking-wider mb-6">OTAA BACKOFFICE</h1>

        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="progression">Progression</TabsTrigger>
            <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <Section title="Players">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Users" value={a.totalUsers} />
                  <StatCard label="Active 24h" value={a.activeUsersLast24h} />
                  <StatCard label="Active 7d" value={a.activeUsersLast7d} />
                  <StatCard label="Avg Runs/User" value={a.avgRunsPerUser} />
                </div>
              </Section>

              <Section title="Retention (Runs per User)">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(a.usersByRunCount).map(([bucket, count]) => (
                    <StatCard key={bucket} label={`${bucket} runs`} value={count} />
                  ))}
                </div>
              </Section>

              <Section title="Runs">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard label="Total Runs" value={a.totalRuns} />
                  <StatCard label="Avg Score" value={a.avgScore} />
                  <StatCard label="Avg Wave" value={a.avgWave} />
                  <StatCard label="Avg Duration" value={`${a.avgDuration}s`} />
                  <StatCard label="Avg Kills/Run" value={a.avgKillsPerRun} />
                  <StatCard label="Survival Rate" value={`${a.survivalRate}%`} />
                </div>
              </Section>

              <Section title="Mode Distribution">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(a.modeDistribution).map(([mode, count]) => (
                    <StatCard key={mode} label={mode} value={`${count} (${a.totalRuns ? Math.round(count / a.totalRuns * 100) : 0}%)`} />
                  ))}
                </div>
              </Section>

              <Section title="Economy">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Avg Scrap/Run" value={a.avgScrapPerRun} />
                  <StatCard label="Avg Cores/Run" value={a.avgCoresPerRun} />
                </div>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="progression">
            <div className="space-y-6">
              <Section title="Weapon Unlock Funnel">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <StatCard label="Avg Runs Before 1st Unlock" value={a.runsBeforeFirstUnlock} />
                  <StatCard label="Users with 2+ Weapons" value={`${a.usersWithMultipleWeapons}/${a.totalUsers}`} />
                </div>
                {a.weaponUnlockOrder.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Weapon</TableHead><TableHead>Avg Runs to Unlock</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.weaponUnlockOrder.map((w) => (
                        <TableRow key={w.weapon}><TableCell>{w.weapon}</TableCell><TableCell>{w.avgRuns}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>

              <Section title="Death Wave Distribution">
                <p className="text-sm text-muted-foreground mb-3">Average death wave: {a.avgDeathWave}</p>
                <div className="flex gap-1 items-end h-24">
                  {Object.entries(a.deathWaveDistribution).sort((a, b) => +a[0] - +b[0]).map(([wave, count]) => {
                    const max = Math.max(...Object.values(a.deathWaveDistribution));
                    return (
                      <div key={wave} className="flex flex-col items-center flex-1">
                        <div className="w-full bg-primary rounded-t" style={{ height: `${(count / max) * 80}px`, minHeight: 2 }} />
                        <span className="text-[10px] text-muted-foreground mt-1">W{wave}</span>
                        <span className="text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="Territory Chains">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Avg Chain Length" value={a.avgChainLength} />
                  {Object.entries(a.chainDistribution).sort((a, b) => +a[0] - +b[0]).map(([chain, count]) => (
                    <StatCard key={chain} label={`Chain ${chain}`} value={count} />
                  ))}
                </div>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="gameplay">
            <div className="space-y-6">
              <Section title="Weapon Popularity & Win Rate">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Weapon</TableHead><TableHead>Usage</TableHead><TableHead>Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(a.weaponPopularity).sort((a, b) => b[1] - a[1]).map(([weapon, count]) => {
                      const wr = a.weaponWinRate[weapon];
                      const winRate = wr ? Math.round((wr.wins / wr.total) * 100) : 0;
                      return (
                        <TableRow key={weapon}>
                          <TableCell className="font-medium">{weapon}</TableCell>
                          <TableCell>{count} ({a.totalRuns ? Math.round(count / a.totalRuns * 100) : 0}%)</TableCell>
                          <TableCell>
                            <Badge variant={winRate > 50 ? 'default' : 'destructive'}>{winRate}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Section>

              <Section title="Quests & Biomes">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Avg Quests/Run" value={a.questsPerRun} />
                  {Object.entries(a.biomeDistribution).sort((a, b) => b[1] - a[1]).map(([biome, count]) => (
                    <StatCard key={biome} label={biome} value={count} />
                  ))}
                </div>
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Section title={`Users (${users.length})`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead><TableHead>Runs</TableHead><TableHead>Kills</TableHead>
                    <TableHead>Best Wave</TableHead><TableHead>Best Score</TableHead><TableHead>Scrap</TableHead>
                    <TableHead>Cores</TableHead><TableHead>Hexes</TableHead><TableHead>Weapons</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.uid} className={`cursor-pointer ${selectedUser === u.uid ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedUser(u.uid)}>
                      <TableCell className="font-mono text-xs">{u.uid.slice(0, 10)}..</TableCell>
                      <TableCell>{u.totalRuns}</TableCell>
                      <TableCell>{u.totalKills}</TableCell>
                      <TableCell>{u.bestWave}</TableCell>
                      <TableCell>{u.bestScore}</TableCell>
                      <TableCell className="text-yellow-400">{u.scrap}</TableCell>
                      <TableCell className="text-cyan-400">{u.cores}</TableCell>
                      <TableCell>{u.conqueredHexes}</TableCell>
                      <TableCell>{u.unlockedWeapons?.length ?? 1}</TableCell>
                      <TableCell className="text-xs">{u.lastSeen?.toDate?.()?.toLocaleDateString() ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>

            {selectedUser && (
              <>
                <Separator className="my-4" />
                <Section title={`Runs — ${selectedUser.slice(0, 10)}..`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mode</TableHead><TableHead>Score</TableHead><TableHead>Wave</TableHead>
                        <TableHead>Kills</TableHead><TableHead>Lvl</TableHead><TableHead>Dur</TableHead>
                        <TableHead>Scrap</TableHead><TableHead>OK</TableHead><TableHead>Chain</TableHead>
                        <TableHead>Quests</TableHead><TableHead>Weapons</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRuns.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.mode}</TableCell>
                          <TableCell>{r.score}</TableCell>
                          <TableCell>{r.wave}</TableCell>
                          <TableCell>{r.kills}</TableCell>
                          <TableCell>{r.level}</TableCell>
                          <TableCell>{r.duration ? `${r.duration}s` : '-'}</TableCell>
                          <TableCell className="text-yellow-400">{r.scrapEarned}</TableCell>
                          <TableCell>
                            <Badge variant={r.survived ? 'default' : 'destructive'}>
                              {r.survived ? 'YES' : 'NO'}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.chainCount ?? 0}</TableCell>
                          <TableCell>{r.questsCompleted ?? 0}</TableCell>
                          <TableCell className="text-xs">{r.equippedWeapons?.join(', ')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              </>
            )}
          </TabsContent>

          <TabsContent value="runs">
            <Section title={`Recent Runs (${runs.length})`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead><TableHead>Mode</TableHead><TableHead>Score</TableHead>
                    <TableHead>Wave</TableHead><TableHead>Kills</TableHead><TableHead>Dur</TableHead>
                    <TableHead>OK</TableHead><TableHead>Diff</TableHead><TableHead>Chain</TableHead>
                    <TableHead>Weapons</TableHead><TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.uid?.slice(0, 8)}..</TableCell>
                      <TableCell>{r.mode}</TableCell>
                      <TableCell>{r.score}</TableCell>
                      <TableCell>{r.wave}</TableCell>
                      <TableCell>{r.kills}</TableCell>
                      <TableCell>{r.duration ? `${r.duration}s` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={r.survived ? 'default' : 'destructive'}>
                          {r.survived ? 'Y' : 'N'}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.hexDifficulty ?? '-'}</TableCell>
                      <TableCell>{r.chainCount ?? 0}</TableCell>
                      <TableCell className="text-xs">{r.equippedWeapons?.join(', ')}</TableCell>
                      <TableCell className="text-xs">{r.timestamp?.toDate?.()?.toLocaleString() ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --- Components ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-3">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

// --- Analytics ---
interface Analytics {
  totalUsers: number; totalRuns: number; avgScore: number; avgWave: number;
  avgDuration: number; avgKillsPerRun: number; survivalRate: number;
  modeDistribution: Record<string, number>; weaponPopularity: Record<string, number>;
  weaponWinRate: Record<string, { total: number; wins: number }>;
  deathWaveDistribution: Record<number, number>; avgDeathWave: number;
  questsPerRun: number; chainDistribution: Record<number, number>; avgChainLength: number;
  biomeDistribution: Record<string, number>; runsBeforeFirstUnlock: number;
  weaponUnlockOrder: { weapon: string; avgRuns: number }[];
  usersWithMultipleWeapons: number; avgScrapPerRun: number; avgCoresPerRun: number;
  activeUsersLast24h: number; activeUsersLast7d: number; avgRunsPerUser: number;
  usersByRunCount: Record<string, number>;
}

function computeAnalytics(users: UserProfile[], runs: RunData[], events: EventData[]): Analytics {
  const now = Date.now();
  const day = 86400000;
  const n = runs.length;

  const avgScore = n ? Math.round(runs.reduce((s, r) => s + r.score, 0) / n) : 0;
  const avgWave = n ? +(runs.reduce((s, r) => s + r.wave, 0) / n).toFixed(1) : 0;
  const durRuns = runs.filter((r) => r.duration > 0);
  const avgDuration = durRuns.length ? Math.round(durRuns.reduce((s, r) => s + r.duration, 0) / durRuns.length) : 0;
  const avgKillsPerRun = n ? Math.round(runs.reduce((s, r) => s + r.kills, 0) / n) : 0;
  const survivalRate = n ? Math.round((runs.filter((r) => r.survived).length / n) * 100) : 0;

  const modeDistribution: Record<string, number> = {};
  const weaponPopularity: Record<string, number> = {};
  const weaponWinRate: Record<string, { total: number; wins: number }> = {};
  const deathWaveDistribution: Record<number, number> = {};
  const chainDistribution: Record<number, number> = {};
  const biomeDistribution: Record<string, number> = {};

  for (const r of runs) {
    modeDistribution[r.mode] = (modeDistribution[r.mode] ?? 0) + 1;
    for (const w of r.equippedWeapons ?? []) {
      weaponPopularity[w] = (weaponPopularity[w] ?? 0) + 1;
      if (!weaponWinRate[w]) weaponWinRate[w] = { total: 0, wins: 0 };
      weaponWinRate[w].total++;
      if (r.survived) weaponWinRate[w].wins++;
    }
    if (!r.survived && r.deathWave) deathWaveDistribution[r.deathWave] = (deathWaveDistribution[r.deathWave] ?? 0) + 1;
    if (r.chainCount && r.chainCount > 0) chainDistribution[r.chainCount] = (chainDistribution[r.chainCount] ?? 0) + 1;
    if (r.hexBiome) biomeDistribution[r.hexBiome] = (biomeDistribution[r.hexBiome] ?? 0) + 1;
  }

  const deathRuns = runs.filter((r) => !r.survived && r.deathWave);
  const avgDeathWave = deathRuns.length ? +(deathRuns.reduce((s, r) => s + (r.deathWave ?? 0), 0) / deathRuns.length).toFixed(1) : 0;
  const questRuns = runs.filter((r) => r.questsCompleted != null);
  const questsPerRun = questRuns.length ? +(questRuns.reduce((s, r) => s + r.questsCompleted, 0) / questRuns.length).toFixed(1) : 0;
  const chainRuns = runs.filter((r) => r.chainCount && r.chainCount > 0);
  const avgChainLength = chainRuns.length ? +(chainRuns.reduce((s, r) => s + (r.chainCount ?? 0), 0) / chainRuns.length).toFixed(1) : 0;

  const unlockEvents = events.filter((e) => e.event === 'weapon_unlock');
  const runsBeforeFirstUnlock = unlockEvents.length
    ? Math.round(unlockEvents.reduce((s, e) => s + (e.totalRuns ?? 0), 0) / unlockEvents.length) : 0;
  const unlockByWeapon: Record<string, number[]> = {};
  for (const e of unlockEvents) {
    const wId = e.weaponId ?? 'unknown';
    if (!unlockByWeapon[wId]) unlockByWeapon[wId] = [];
    unlockByWeapon[wId].push(e.totalRuns ?? 0);
  }
  const weaponUnlockOrder = Object.entries(unlockByWeapon)
    .map(([weapon, arr]) => ({ weapon, avgRuns: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }))
    .sort((a, b) => a.avgRuns - b.avgRuns);

  const avgScrapPerRun = n ? Math.round(runs.reduce((s, r) => s + (r.scrapEarned ?? 0), 0) / n) : 0;
  const avgCoresPerRun = n ? +(runs.reduce((s, r) => s + (r.coresEarned ?? 0), 0) / n).toFixed(2) : 0;

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
    totalUsers: users.length, totalRuns: n, avgScore, avgWave, avgDuration, avgKillsPerRun, survivalRate,
    modeDistribution, weaponPopularity, weaponWinRate, deathWaveDistribution, avgDeathWave,
    questsPerRun, chainDistribution, avgChainLength, biomeDistribution,
    runsBeforeFirstUnlock, weaponUnlockOrder,
    usersWithMultipleWeapons: users.filter((u) => (u.unlockedWeapons?.length ?? 0) > 1).length,
    avgScrapPerRun, avgCoresPerRun,
    activeUsersLast24h: users.filter((u) => u.lastSeen && (now - u.lastSeen.toDate().getTime()) < day).length,
    activeUsersLast7d: users.filter((u) => u.lastSeen && (now - u.lastSeen.toDate().getTime()) < day * 7).length,
    avgRunsPerUser: users.length ? +(users.reduce((s, u) => s + u.totalRuns, 0) / users.length).toFixed(1) : 0,
    usersByRunCount,
  };
}
