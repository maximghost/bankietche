# Bankiétché — Mon banquier

> *Bankiétché* : « mon banquier » en fon.
> Une application de gestion de budget pour les jeunes au Bénin. Elle tient compte du Mobile Money (MTN, Moov, Celtiis), des tontines et de l'épargne par objectif.
> Une appli **Ghost.Technologies**, commercialisée via **Ghost.Store** (Chariow).

- Elle **fonctionne dans le navigateur** du téléphone, sans passer par un store. On peut l'installer sur l'écran d'accueil (PWA).
- Elle **marche hors connexion**. Une connexion n'est nécessaire qu'une fois, pour activer le code.
- Les **données restent sur le téléphone** (IndexedDB). La sauvegarde et la restauration se font par fichier.
- Elle est **légère** : environ 55 Ko compressés à télécharger.
- Elle est **personnalisée** : prénom ou pseudo, et une période de gestion au choix (journalière, hebdomadaire, mensuelle, annuelle ou libre).
- Elle est **accessible** : contrastes AA, navigation au clavier, lecteur d'écran, thème sombre. Audit axe-core WCAG 2 A/AA sans violation.

---

## 1. Architecture

```
┌──────────────────────── Téléphone de l'acheteur ───────────────────────┐
│  PWA Bankiétché (Preact + TypeScript)                                   │
│   ├─ IndexedDB : opérations, catégories, tontines, objectifs (local)    │
│   ├─ Service worker : cache de l'appli → fonctionne hors connexion      │
│   └─ Licence : activée 1 fois, revérifiée tous les 7 jours si en ligne  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ 2 fonctions SQL seulement
                                 ▼
┌──────────── Supabase (géré par toi) ────────────┐      ┌──── Chariow ────┐
│ licences, activations, activation_attempts      │◄─CSV─┤ Produit         │
│ activate_licence() / verify_licence()  (public) │      │ « Licences » :  │
│ generate_licences() / licence_overview (admin)  │      │ 1 clé par vente │
└─────────────────────────────────────────────────┘      └─────────────────┘
```

| Dossier | Rôle |
|---|---|
| `src/domain/` | Logique métier pure et testée : périodes, budget, messages personnalisés, tontines, objectifs |
| `src/legal/` | CGU, politique de confidentialité, mentions légales et identité de l'éditeur |
| `src/data/` | Stockage IndexedDB (`db.ts`) et sauvegarde/restauration (`backup.ts`) |
| `src/services/licence.ts` | Activation et vérification des codes |
| `src/state/store.tsx` | État global et actions (ajouter, modifier, supprimer…) |
| `src/ui/` | Écrans, formulaires et composants |
| `supabase/migrations/` | Script SQL du serveur de licences |
| `tests/` | Tests unitaires (Vitest) |
| `.github/workflows/` | Déploiement automatique et maintien de Supabase actif |

---

## 2. Mise en place (une seule fois)

### 2.1 Supabase
1. Crée un projet sur [supabase.com](https://supabase.com). Choisis la région la plus proche de tes clients (Europe, par exemple).
2. Ouvre **SQL Editor → New query**, colle le contenu de `supabase/migrations/001_licences.sql`, puis clique sur **Run**. Fais de même avec `002_purge_attempts.sql`, qui supprime automatiquement les tentatives d'activation de plus de 30 jours, comme l'annonce la politique de confidentialité.
3. Note la **Project URL** (Project Settings → Data API) et la clé **publishable** `sb_publishable_…` (Project Settings → API Keys).
   ⚠️ Ne mets **jamais** la clé secret `sb_secret_…` (ni l'ancienne `service_role`) dans l'appli ou sur GitHub.

### 2.2 GitHub
1. Crée un dépôt `bankietche` sur ton compte (il peut être **privé**) et pousse ce dossier dessus.
2. Dans **Settings → Pages → Source**, choisis **GitHub Actions**.
   *Note : avec un dépôt privé, GitHub Pages demande un compte GitHub payant ou Education. Sinon, mets le dépôt en public : le code ne contient aucun secret.*
3. Dans **Settings → Secrets and variables → Actions → New repository secret**, ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CHARIOW_URL` (le lien de ta page produit)
4. Pousse sur `main`. L'appli est publiée sur `https://maximghost.github.io/bankietche/`.

### 2.3 Générer les codes et les mettre dans Chariow
1. Dans le SQL Editor de Supabase :
   ```sql
   select * from public.generate_licences(200, 'lot-2026-11');
   ```
2. Exporte le résultat en CSV (bouton **Export / Download CSV** sous les résultats).
3. Sur Chariow : **Ajouter un produit → Licences**. Mode de distribution : **Stock de clés (import manuel)**. Importe les codes.
   ⚠️ N'active **pas** la génération automatique de Chariow : ces codes-là n'existeraient pas dans Supabase et seraient refusés par l'appli.
4. Dans le message envoyé après l'achat, mets le lien de l'appli et la marche à suivre (voir §6).
5. Quand le stock baisse, génère un nouveau lot (`'lot-2026-12'`…) et importe-le.

> Le format exact du fichier d'import attendu par Chariow (une clé par ligne, avec ou sans en-tête) est à vérifier dans ton tableau de bord.

---

## 3. Avant la mise en vente : liste de vérification

1. Complète `src/legal/identity.ts` (statut juridique, RCCM/IFU ou « en cours d'immatriculation », adresse, e-mail et WhatsApp du support, région Supabase), puis vérifie :
   ```bash
   npm run check:legal
   ```
2. Fais relire les textes de `src/legal/texts.tsx` par un juriste.
3. Renseigne-toi auprès de l'APDP sur les formalités applicables au serveur de licences. Le Code du numérique prévoit en principe une formalité préalable pour tout traitement de données personnelles.
4. Si tu modifies les CGU plus tard, change `LEGAL_VERSION` : chaque utilisateur devra les accepter de nouveau à l'ouverture.

## 4. Gérer les licences (SQL Editor)

```sql
-- Vue d'ensemble : codes, activations, dernière utilisation
select * from public.licence_overview order by created_at desc;

-- Codes encore jamais utilisés
select code from public.licence_overview where activations = 0 and status = 'active';

-- Révoquer un code (remboursement, partage abusif) : l'appli se bloque
-- à sa prochaine vérification en ligne (au plus tard 7 jours après).
update public.licences set status = 'revoked', note = 'remboursé' where code = 'BKT-XXXX-XXXX';

-- Un client a changé de téléphone et a atteint la limite : libérer ses appareils
delete from public.activations where code = 'BKT-XXXX-XXXX';

-- Autoriser un 3e appareil pour un code
update public.licences set max_activations = 3 where code = 'BKT-XXXX-XXXX';
```

**Règles intégrées** : 2 téléphones maximum par code ; 10 essais ratés par heure et par téléphone (protection contre ceux qui essaient des codes au hasard) ; les tables ne sont pas lisibles avec la clé publique.

---

## 5. Développement

```bash
npm install
cp .env.example .env.local   # puis remplir
npm run dev                  # http://localhost:5173/bankietche/
npm test                     # tests unitaires
npm run build                # build de production dans dist/
```

En local (`npm run dev` uniquement), le code **`BKT-DEMO-DEMO`** active l'appli sans serveur. Il est retiré automatiquement du build de production.

Pour simuler un téléphone : ouvre Chrome, puis F12 → Ctrl+Maj+M (mode appareil mobile).
⚠️ N'ouvre pas l'appli de dev sur ton téléphone via l'adresse IP du PC (`http://192.168…`) : le navigateur bloque les fonctions sécurisées hors HTTPS (identifiant d'appareil, mode hors connexion). Teste sur téléphone avec la version publiée sur GitHub Pages, qui est en HTTPS.

### Publier une mise à jour
1. Incrémente `APP_VERSION` dans `src/config.ts` et `version` dans `package.json`.
2. Pousse sur `main`. Les utilisateurs verront le bandeau **« Nouvelle version disponible · Mettre à jour »**.

### Faire évoluer les données
- **Stockage local** : incrémente `DB_VERSION` dans `src/data/db.ts` et ajoute un bloc `if (oldVersion < N)`. Ne modifie jamais un bloc existant. Exemple réel : la migration v1 → v2 remplace les émojis par des icônes, et elle est couverte par un test.
- **Icônes** : `src/ui/icon-registry.tsx`. Ne renomme jamais une clé existante, car elle est enregistrée dans les données des utilisateurs.
- **Sauvegarde** : si le format change, incrémente `BACKUP_SCHEMA` et ajoute la conversion dans `parseBackup()`.
- **Supabase** : ajoute un fichier `002_….sql`. Ne modifie pas `001`, qui est déjà en production.

---

## 6. Texte à mettre dans le message après achat (Chariow)

> Merci pour ton achat ! 🎉
> 1. Ouvre ce lien sur ton téléphone : **https://maximghost.github.io/bankietche/**
> 2. Entre ton code d'activation (il commence par BKT-). Une connexion Internet est nécessaire juste cette fois.
> 3. Pour l'avoir comme une vraie appli : dans Chrome, menu ⋮ → **« Ajouter à l'écran d'accueil »**.
>
> 💡 Pense à faire une sauvegarde de temps en temps (⚙️ Réglages → Sauvegarder) pour ne rien perdre si tu changes de téléphone.
> Ton code fonctionne sur 2 téléphones maximum.

---

## 7. Limites connues et pistes d'évolution

- **Protection** : l'appli tourne entièrement dans le téléphone. Une personne très technique pourrait contourner l'écran d'activation. Pour un produit à petit prix, c’est un compromis assumé : ce qu'on protège réellement, ce sont les codes, qui sont uniques, limités à 2 appareils et révocables.
- **Mise en pause de Supabase** (offre gratuite) : un projet peu actif pendant 7 jours est mis en pause, et les nouvelles activations échouent alors. Le workflow `keep-alive.yml` interroge la base chaque jour pour réduire ce risque. Supabase envoie aussi un e-mail d'avertissement avant la pause. Si les ventes décollent, le plan Pro supprime ce risque. Les utilisateurs déjà activés ne sont **jamais** bloqués par une pause.
- **Données** : elles sont perdues si l'utilisateur vide les données de son navigateur sans avoir fait de sauvegarde. L'appli rappelle de sauvegarder tous les 14 jours.
- **Pistes d'évolution** : synchronisation dans le cloud (Supabase Auth + tables utilisateurs), « Qui me doit / à qui je dois », notifications de rappel des cotisations, export PDF.

---

© Ghost.Technologies — Yaovi Joel Maxim TOKINLO
