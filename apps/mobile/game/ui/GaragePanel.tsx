import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useMetaStore } from '../engine/meta';
import {
  WEAPON_DEFS,
  type WeaponId,
  type WeaponUpgrades,
  getWeaponEffective,
} from '../engine/weapons';
import {
  type GlobalStatId,
  TANK_UPGRADE_DEFS,
  getTankUpgradeCost,
} from '../engine/stats';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_YELLOW, WIREFRAME_RED, BG_BLACK } from '../engine/constants';

type Tab = 'tank' | 'weapons' | 'upgrades';

interface Props {
  onClose: () => void;
}

export function GaragePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('tank');
  const scrap = useMetaStore((s) => s.scrap);
  const cores = useMetaStore((s) => s.cores);

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>GARAGE</Text>
        <View style={styles.currencies}>
          <Text style={styles.currency}>SCRAP <Text style={styles.scrapVal}>{scrap}</Text></Text>
          <Text style={styles.currency}>CORES <Text style={styles.coresVal}>{cores}</Text></Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>X</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {(['tank', 'weapons', 'upgrades'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.content}>
        {tab === 'tank' && <TankTab />}
        {tab === 'weapons' && <WeaponsTab />}
        {tab === 'upgrades' && <UpgradesTab />}
      </View>
    </View>
  );
}

function TankTab() {
  const { tankUpgrades, scrap } = useMetaStore();
  const { upgradeTank } = useMetaStore();

  const statIds = Object.keys(TANK_UPGRADE_DEFS) as GlobalStatId[];

  return (
    <ScrollView style={styles.section}>
      <Text style={styles.hint}>Permanent upgrades — apply to every run</Text>
      {statIds.map((statId) => {
        const def = TANK_UPGRADE_DEFS[statId];
        const level = tankUpgrades[statId];
        const cost = getTankUpgradeCost(statId, level);
        const canAfford = scrap >= cost && level < def.maxLevel;

        return (
          <View key={statId} style={styles.upgradeSection}>
            <View style={styles.weaponHeader}>
              <Text style={styles.weaponName}>{def.icon} {def.name}</Text>
            </View>
            <Text style={styles.weaponDesc}>{def.description}</Text>
            <View style={styles.upgradeRow}>
              <View style={styles.upgradeInfo}>
                <View style={styles.levelDots}>
                  {Array.from({ length: def.maxLevel }).map((_, i) => (
                    <View key={i} style={[styles.dot, i < level && styles.dotFilled]} />
                  ))}
                </View>
              </View>
              <Pressable
                style={[styles.upgradeBuyBtn, !canAfford && styles.actionBtnDisabled]}
                onPress={() => upgradeTank(statId)}
                disabled={!canAfford}
              >
                <Text style={styles.actionBtnText}>
                  {level >= def.maxLevel ? 'MAX' : `${cost}S`}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function WeaponsTab() {
  const { unlockedWeapons, equippedWeapons, weaponUpgrades, scrap, cores } = useMetaStore();
  const { unlockWeapon, equipWeapon, unequipWeapon } = useMetaStore();

  return (
    <ScrollView style={styles.section}>
      <Text style={styles.hint}>Equip up to 2 weapons</Text>
      {Object.values(WEAPON_DEFS).map((def) => {
        const isUnlocked = unlockedWeapons.includes(def.id);
        const isEquipped = equippedWeapons.includes(def.id);
        const upgrades = weaponUpgrades[def.id];
        const eff = getWeaponEffective(def.id, upgrades);
        const canAfford = scrap >= def.unlockCost.scrap && cores >= def.unlockCost.cores;

        return (
          <View key={def.id} style={[styles.weaponCard, isEquipped && styles.weaponCardEquipped]}>
            <View style={styles.weaponHeader}>
              <Text style={styles.weaponName}>{def.name}</Text>
              {isEquipped && <Text style={styles.equippedBadge}>[EQUIPPED]</Text>}
            </View>
            <Text style={styles.weaponDesc}>{def.description}</Text>
            <View style={styles.weaponStats}>
              <Text style={styles.weaponStat}>DMG {eff.damage}</Text>
              <Text style={styles.weaponStat}>RATE {eff.fireRate.toFixed(2)}s</Text>
              <Text style={styles.weaponStat}>SPD {eff.projectileSpeed}</Text>
            </View>
            {!isUnlocked ? (
              <Pressable
                style={[styles.actionBtn, !canAfford && styles.actionBtnDisabled]}
                onPress={() => unlockWeapon(def.id)}
                disabled={!canAfford}
              >
                <Text style={styles.actionBtnText}>
                  UNLOCK [{def.unlockCost.scrap}S {def.unlockCost.cores}C]
                </Text>
              </Pressable>
            ) : isEquipped ? (
              <Pressable
                style={[styles.actionBtn, equippedWeapons.length <= 1 && styles.actionBtnDisabled]}
                onPress={() => unequipWeapon(def.id)}
                disabled={equippedWeapons.length <= 1}
              >
                <Text style={styles.actionBtnText}>UNEQUIP</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.actionBtn} onPress={() => equipWeapon(def.id)}>
                <Text style={styles.actionBtnText}>EQUIP</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function UpgradesTab() {
  const { equippedWeapons, weaponUpgrades, scrap } = useMetaStore();
  const { upgradeWeapon } = useMetaStore();

  return (
    <ScrollView style={styles.section}>
      {equippedWeapons.map((weaponId) => {
        const def = WEAPON_DEFS[weaponId];
        const upgrades = weaponUpgrades[weaponId];
        if (!upgrades) return null;
        const labels: Record<string, string> = { damage: 'DAMAGE', fireRate: 'FIRE RATE', speed: 'PROJ. SPEED' };

        return (
          <View key={weaponId} style={styles.upgradeSection}>
            <Text style={styles.weaponName}>{def.name}</Text>
            {(['damage', 'fireRate', 'speed'] as (keyof WeaponUpgrades)[]).map((stat) => {
              const level = upgrades[stat];
              const maxLevel = def.maxUpgradeLevel;
              const cost = def.upgradeScrapCost * (level + 1);
              const canAfford = scrap >= cost && level < maxLevel;
              return (
                <View key={stat} style={styles.upgradeRow}>
                  <View style={styles.upgradeInfo}>
                    <Text style={styles.upgradeName}>{labels[stat]}</Text>
                    <View style={styles.levelDots}>
                      {Array.from({ length: maxLevel }).map((_, i) => (
                        <View key={i} style={[styles.dot, i < level && styles.dotFilled]} />
                      ))}
                    </View>
                  </View>
                  <Pressable
                    style={[styles.upgradeBuyBtn, !canAfford && styles.actionBtnDisabled]}
                    onPress={() => upgradeWeapon(weaponId, stat)}
                    disabled={!canAfford}
                  >
                    <Text style={styles.actionBtnText}>
                      {level >= maxLevel ? 'MAX' : `${cost}S`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_BLACK + 'f5',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: WIREFRAME_GREEN,
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  currencies: {
    flexDirection: 'row',
    gap: 16,
  },
  currency: {
    color: '#00ff0088',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  scrapVal: { color: WIREFRAME_YELLOW, fontWeight: 'bold' },
  coresVal: { color: WIREFRAME_CYAN, fontWeight: 'bold' },
  closeBtn: {
    padding: 8,
    borderWidth: 1,
    borderColor: WIREFRAME_RED,
  },
  closeText: {
    color: WIREFRAME_RED,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#00ff0033',
    alignItems: 'center',
  },
  tabActive: {
    borderColor: WIREFRAME_GREEN,
    backgroundColor: '#00ff0011',
  },
  tabText: {
    color: '#00ff0066',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  tabTextActive: { color: WIREFRAME_GREEN },
  content: { flex: 1 },
  section: { flex: 1 },
  hint: {
    color: '#00ff0066',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  weaponCard: {
    borderWidth: 1,
    borderColor: '#00ff0033',
    padding: 12,
    marginBottom: 10,
  },
  weaponCardEquipped: { borderColor: WIREFRAME_GREEN },
  weaponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  weaponName: {
    color: WIREFRAME_GREEN,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  equippedBadge: {
    color: WIREFRAME_CYAN,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  weaponDesc: {
    color: '#00ff0066',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  weaponStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  weaponStat: {
    color: WIREFRAME_GREEN,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  actionBtnDisabled: {
    borderColor: '#00ff0033',
    opacity: 0.4,
  },
  actionBtnText: {
    color: WIREFRAME_GREEN,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  upgradeSection: {
    borderWidth: 1,
    borderColor: '#00ff0033',
    padding: 12,
    marginBottom: 10,
  },
  upgradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeInfo: { flex: 1, gap: 4 },
  upgradeName: {
    color: '#00ff0088',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  levelDots: { flexDirection: 'row', gap: 3 },
  dot: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
  },
  dotFilled: { backgroundColor: WIREFRAME_GREEN },
  upgradeBuyBtn: {
    borderWidth: 1,
    borderColor: WIREFRAME_YELLOW,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 12,
  },
});
