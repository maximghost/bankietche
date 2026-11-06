import { LEGAL_IDENTITY as L, LEGAL_UPDATED } from './identity';

/*
 * Textes juridiques de Bankiétché.
 * Rédigés pour refléter fidèlement le fonctionnement technique de l'appli.
 * Ils doivent être relus par un juriste avant la mise en vente ; toute
 * évolution technique touchant aux données doit être répercutée ici.
 */

const Updated = () => <p class="legal-updated">Dernière mise à jour : {LEGAL_UPDATED}</p>;

export function TermsText() {
  return (
    <article class="legal">
      <Updated />
      <h3>1. Objet</h3>
      <p>
        Les présentes conditions générales d’utilisation (CGU) encadrent l’utilisation de l’application
        Bankiétché (« l’Application »), éditée par {L.editor} et commercialisée via {L.store}.
        L’Application aide l’utilisateur à suivre ses dépenses, ses entrées d’argent, ses budgets, ses
        tontines et son épargne. Activer l’Application vaut acceptation des présentes CGU.
      </p>

      <h3>2. Licence d’utilisation</h3>
      <p>
        L’achat donne droit à un code d’activation personnel. Ce code ouvre un droit d’usage personnel,
        non exclusif et non cessible de l’Application, sur <strong>deux (2) appareils au maximum</strong>.
        Le code ne peut être ni revendu, ni partagé publiquement. Un changement de téléphone peut être
        traité par le support.
      </p>

      <h3>3. Fonctionnement et données</h3>
      <p>
        Les informations saisies (opérations, budgets, tontines, objectifs, prénom ou pseudo) sont
        enregistrées <strong>uniquement dans le navigateur de l’appareil</strong>. Elles ne sont ni
        transmises ni conservées par l’éditeur. Par conséquent :
      </p>
      <ul>
        <li>l’utilisateur est seul responsable de la sauvegarde de ses données, grâce à la fonction « Sauvegarder » prévue à cet effet ;</li>
        <li>la suppression des données du navigateur, la réinitialisation ou la perte de l’appareil entraînent la perte des données non sauvegardées ;</li>
        <li>l’éditeur n’est pas en mesure de récupérer des données perdues.</li>
      </ul>
      <p>Le détail figure dans la Politique de confidentialité.</p>

      <h3>4. Nature du service</h3>
      <p>
        Bankiétché est un outil d’organisation personnelle. Les montants affichés sont calculés à partir
        des seules informations saisies par l’utilisateur. Bankiétché n’est ni une banque, ni un
        établissement de paiement : elle ne détient pas d’argent, n’effectue aucun paiement, n’est pas
        reliée aux comptes Mobile Money et ne fournit pas de conseil financier.
      </p>

      <h3>5. Disponibilité et mises à jour</h3>
      <p>
        Après activation, l’Application fonctionne sans connexion. Une connexion est nécessaire pour
        l’activation et, périodiquement, pour vérifier la validité du code. Les rappels quotidiens sont un service
        facultatif ; leur bonne réception dépend du téléphone, de ses réglages (économie d’énergie, mode
        Concentration, autorisations) et des services de notification d’Apple ou de Google. L’éditeur peut publier des
        mises à jour correctives ou fonctionnelles ; elles sont proposées à l’utilisateur à l’ouverture de
        l’Application.
      </p>

      <h3>6. Désactivation d’un code</h3>
      <p>
        L’éditeur peut désactiver un code en cas de remboursement, de fraude, de revente ou de partage
        manifeste. L’Application est alors bloquée lors de sa vérification suivante. Les données restent
        sur l’appareil et peuvent être exportées avant la désactivation.
      </p>

      <h3>7. Propriété intellectuelle</h3>
      <p>
        L’Application, son nom, son logo, son code et ses contenus sont la propriété de {L.editor}. Toute
        reproduction, modification, décompilation ou redistribution sans autorisation écrite est interdite.
      </p>

      <h3>8. Responsabilité</h3>
      <p>
        L’Application est fournie avec soin, en l’état. L’éditeur ne saurait être tenu responsable des
        décisions financières prises par l’utilisateur, d’une erreur de saisie, ni d’une perte de données
        non sauvegardées. La responsabilité de l’éditeur, si elle était engagée, est limitée au prix payé
        pour la licence.
      </p>

      <h3>9. Achat, remboursement</h3>
      <p>
        La vente est réalisée via {L.store}, selon les conditions générales de vente de la boutique.
        Toute demande liée à un achat est à adresser au support.
      </p>

      <h3>10. Droit applicable</h3>
      <p>
        Les présentes CGU sont soumises au droit de la République du Bénin. En cas de différend, une
        solution amiable sera recherchée avant toute action devant les juridictions compétentes.
      </p>

      <h3>11. Contact</h3>
      <p>Support : {L.email} · WhatsApp : {L.whatsapp}</p>
    </article>
  );
}

export function PrivacyText() {
  return (
    <article class="legal">
      <Updated />
      <p class="legal-lead">
        En bref : <strong>tes données financières ne quittent jamais ton téléphone.</strong> Pas de compte,
        pas de publicité, pas de traceur, pas de revente de données.
      </p>

      <h3>1. Responsable du traitement</h3>
      <p>{L.editor}, représentée par {L.representative} — {L.address}. Contact : {L.email}.</p>

      <h3>2. Données conservées uniquement sur ton appareil</h3>
      <p>
        Opérations, montants, catégories, budgets, tontines, objectifs, prénom ou pseudo et préférences
        sont stockés dans le navigateur de ton téléphone (stockage local). L’éditeur n’y a pas accès. Les
        fichiers de sauvegarde que tu crées restent sous ton contrôle : choisis avec soin où tu les
        envoies.
      </p>

      <h3>3. Données traitées par le serveur de licences</h3>
      <p>Pour vérifier les codes d’activation et prévenir la fraude, le serveur enregistre uniquement :</p>
      <ul>
        <li>le code de licence ;</li>
        <li>un identifiant d’appareil aléatoire, créé par l’Application, sans lien avec ton identité, ton numéro ou ton téléphone ;</li>
        <li>la version de l’Application, la date d’activation et la date de dernière vérification ;</li>
        <li>les tentatives d’activation (code saisi, réussite ou échec), conservées <strong>30 jours</strong>.</li>
      </ul>
      <p>
        Aucun nom, numéro de téléphone, e-mail, montant ni contenu de ton budget n’est transmis.
        Finalité : exécution du contrat de licence et sécurité. Hébergement : Supabase, région
        {' '}{L.licenceServerRegion}. Les données d’activation sont conservées pendant la durée de vie de
        la licence.
      </p>

      <h3>4. Rappels quotidiens (facultatifs)</h3>
      <p>
        Si tu actives le rappel quotidien, le serveur enregistre uniquement : l’adresse technique de notification
        fournie par ton navigateur (et ses clés de chiffrement), l’heure du rappel, ton fuseau horaire, ainsi que
        ton code de licence et l’identifiant d’appareil aléatoire, pour réserver ce service aux licences valides.
      </p>
      <p>
        Chaque jour, le serveur envoie un simple signal <strong>sans aucune donnée</strong>. C’est ton téléphone qui
        rédige le message à partir de ses données locales. Le signal transite, chiffré, par le service de
        notification de ton téléphone (Apple ou Google). Par défaut, le message reste général ; l’option « Messages
        détaillés », que tu peux activer, affiche des noms et montants sur l’écran verrouillé.
      </p>
      <p>
        Ces données sont supprimées dès que tu désactives les rappels, lorsque l’adresse expire ou lorsque la licence
        est supprimée. Tu peux désactiver les rappels à tout moment dans Réglages › Rappel quotidien.
      </p>

      <h3>5. Achat</h3>
      <p>
        Le paiement est traité par Chariow et les opérateurs de paiement, selon leurs propres politiques.
        L’éditeur reçoit les informations de commande que Chariow met à disposition des vendeurs, et ne
        les utilise que pour le suivi des ventes et le support.
      </p>

      <h3>6. Hébergement de l’Application</h3>
      <p>
        L’Application est servie par GitHub Pages (GitHub, Inc.). Comme tout hébergeur web, GitHub peut
        enregistrer des journaux techniques (adresse IP, type de navigateur) lors du téléchargement de
        l’Application. Bankiétché n’utilise ni cookie publicitaire ni outil de mesure d’audience.
      </p>

      <h3>7. Tes droits</h3>
      <p>
        Conformément au Livre V du Code du numérique (loi n° 2017-20 du 20 avril 2018, modifiée par la
        loi n° 2020-35 du 6 janvier 2021), tu disposes d’un droit d’accès, de rectification,
        d’opposition et de suppression des données te concernant. Pour les données du serveur de
        licences, écris au support en indiquant ton code. Les données locales se gèrent directement dans
        l’Application : Réglages › Effacer toutes les données. Tu peux également saisir l’Autorité de
        Protection des Données à caractère Personnel (APDP).
      </p>

      <h3>8. Sécurité</h3>
      <p>
        Les échanges avec le serveur de licences sont chiffrés (HTTPS). Le serveur n’expose aucune liste de
        codes ou d’appareils. Protège l’accès à ton téléphone : toute personne qui y accède peut ouvrir
        l’Application. Le mode discret permet de masquer les montants à l’écran.
      </p>

      <h3>9. Évolution de cette politique</h3>
      <p>Toute modification importante sera signalée dans l’Application.</p>
    </article>
  );
}

export function LegalNoticeText() {
  return (
    <article class="legal">
      <Updated />
      <h3>Éditeur</h3>
      <p>
        {L.editor} — {L.legalStatus}<br />
        {L.registration}<br />
        {L.address}<br />
        Responsable de la publication : {L.representative}<br />
        Contact : {L.email}
      </p>
      <h3>Commercialisation</h3>
      <p>{L.store}</p>
      <h3>Hébergement de l’Application</h3>
      <p>GitHub Pages — GitHub, Inc., San Francisco, Californie, États-Unis.</p>
      <h3>Serveur de licences</h3>
      <p>Supabase — région {L.licenceServerRegion}.</p>
      <h3>Crédits</h3>
      <p>Icônes : Lucide (licence ISC). Bibliothèques : Preact (MIT), idb (ISC), Workbox (MIT).</p>
    </article>
  );
}
