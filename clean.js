import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstitution de __dirname pour ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extensions de fichiers à traiter
const EXTENSIONS_CIBLES = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.php']);

// Dossiers ou fichiers à ignorer impérativement
const IGNORER = new Set(['node_modules', '.git', 'dist', 'build', '.next', path.basename(__filename)]);

/**
 * Nettoie les commentaires selon le type de fichier
 */
function supprimerCommentaires(contenu, ext) {
  if (['.html', '.php'].includes(ext)) {
    // Supprime <!-- commentaire -->
    return contenu.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Pour JS, TS, CSS, SCSS...
  // Protège les chaînes de caractères ("...", '...', `...`) pour éviter d'effacer les // ou /* situés DEDANS.
  return contenu.replace(
    /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|(\/\*[\s\S]*?\*\/|\/\/(?:[^\r\n]*))/g,
    (match, group1) => (group1 ? group1 : '')
  );
}

/**
 * Parcourt les dossiers récursivement
 */
function parcourirEtTraiter(dossierCourant) {
  const elements = fs.readdirSync(dossierCourant);

  for (const element of elements) {
    if (IGNORER.has(element)) continue;

    const cheminComplet = path.join(dossierCourant, element);
    const stat = fs.statSync(cheminComplet);

    if (stat.isDirectory()) {
      parcourirEtTraiter(cheminComplet);
    } else if (stat.isFile()) {
      const ext = path.extname(element).toLowerCase();

      if (EXTENSIONS_CIBLES.has(ext)) {
        try {
          const contenuOriginal = fs.readFileSync(cheminComplet, 'utf8');
          const contenuPropre = supprimerCommentaires(contenuOriginal, ext);

          if (contenuOriginal !== contenuPropre) {
            fs.writeFileSync(cheminComplet, contenuPropre, 'utf8');
            console.log(`✅ Commentaires supprimés : ${path.relative(process.cwd(), cheminComplet)}`);
          }
        } catch (err) {
          console.error(`❌ Erreur sur ${cheminComplet} :`, err.message);
        }
      }
    }
  }
}

// Lancement du traitement
console.log('🚀 Analyse et nettoyage des commentaires en cours...\n');
parcourirEtTraiter(__dirname);
console.log('\n✨ Terminé avec succès !');