const { NlpManager } = require('node-nlp');

const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Entraînement du cerveau UAP Immo (Mode Expert)...');

    // --- 1. PROFIL & ADRESSE ---
    manager.addDocument('fr', 'ou sont mes informations personnelles', 'profile.info');
    manager.addDocument('fr', 'voir mon profil', 'profile.info');
    manager.addDocument('fr', 'mon compte', 'profile.info');
    
    manager.addDocument('fr', 'comment modifier mon adresse', 'profile.address');
    manager.addDocument('fr', 'changer adresse facturation', 'profile.address');
    manager.addDocument('fr', 'ajouter une adresse', 'profile.address');
    manager.addDocument('fr', 'mettre a jour mes coordonnées', 'profile.address');

    // --- 2. PROCESSUS GÉNÉRAL ---
    manager.addDocument('fr', 'comment fonctionne la plateforme', 'platform.guide');
    manager.addDocument('fr', 'que dois-je faire', 'platform.guide');
    manager.addDocument('fr', 'expliquer le fonctionnement', 'platform.guide');
    manager.addAnswer('fr', 'platform.guide', 'Le processus est simple : 1. Créez une annonce via le formulaire. 2. Une page web est générée instantanément. 3. Partagez le lien ou le QR Code gratuitement. 4. (Optionnel) Payez un pack pour diffuser l\'annonce professionnellement.');

    // --- 3. CRÉATION D'ANNONCE (DÉTAILS) ---
    manager.addDocument('fr', 'comment créer une page', 'listing.create');
    manager.addDocument('fr', 'ajouter une propriété', 'listing.create');
    manager.addDocument('fr', 'faire une nouvelle annonce', 'listing.create');

    manager.addDocument('fr', 'mettre une vidéo', 'listing.media');
    manager.addDocument('fr', 'photos ou vidéo', 'listing.media');
    manager.addDocument('fr', 'comment marche le slider', 'listing.media');
    manager.addAnswer('fr', 'listing.media', 'C\'est flexible : Si vous ajoutez un lien YouTube, la page aura un **fond vidéo immersif**. Si vous ne mettez pas de vidéo, la page affichera un **slider (carrousel)** avec vos photos principales.');

    manager.addDocument('fr', 'quelle langue choisir', 'listing.lang');
    manager.addDocument('fr', 'traduire mon annonce', 'listing.lang');
    manager.addAnswer('fr', 'listing.lang', 'Vous pouvez choisir entre Français, Anglais, Espagnol ou Portugais à la fin du formulaire. Attention : écrivez votre description dans la langue choisie, le site ne traduit pas automatiquement votre texte.');

    manager.addDocument('fr', 'format des photos', 'listing.format');
    manager.addDocument('fr', 'taille images', 'listing.format');
    manager.addDocument('fr', 'poids photos', 'listing.format');
    manager.addAnswer('fr', 'listing.format', 'Nous acceptons les formats JPG, PNG et WEBP. Pour une performance optimale, essayez de garder des images sous 5 Mo chacune.');

    // --- 4. GESTION (PAGES CRÉÉES) ---
    manager.addDocument('fr', 'ou sont mes pages', 'listing.manage');
    manager.addDocument('fr', 'modifier mon annonce', 'listing.manage');
    manager.addDocument('fr', 'comment partager', 'listing.manage');
    manager.addDocument('fr', 'trouver le qr code', 'listing.manage');
    manager.addAnswer('fr', 'listing.manage', 'Tout se passe dans l\'onglet **"Pages créées"**. Vous y trouverez les boutons pour : Modifier (crayon), Voir (œil), Copier le lien, Afficher le QR Code et Diffuser (mégaphone).');

    // --- 5. STATISTIQUES ---
    manager.addDocument('fr', 'a quoi sert le tableau statistics', 'stats.info');
    manager.addDocument('fr', 'comprendre les stats', 'stats.info');
    manager.addDocument('fr', 'qui visite ma page', 'stats.info');
    manager.addAnswer('fr', 'stats.info', 'Le tableau de statistiques vous permet de suivre la performance de vos annonces : nombre de vues, visiteurs uniques, pays d\'origine, type d\'appareil (mobile/PC) et source du trafic.');

    // --- 6. COMMANDES & PAIEMENT ---
    manager.addDocument('fr', 'comment payer', 'payment.how');
    manager.addDocument('fr', 'moyens de paiement', 'payment.how');
    manager.addAnswer('fr', 'payment.how', 'Pour payer, allez dans "Pages créées" et cliquez sur l\'icône Mégaphone. Vous pourrez régler 500€ via **PayPal** (Carte bancaire) ou **Bitcoin** (Crypto).');

    manager.addDocument('fr', 'ma dernière commande', 'order.last');
    manager.addDocument('fr', 'statut de ma commande', 'order.last');
    manager.addDocument('fr', 'ai-je payé', 'order.last');

    // --- 7. RECHERCHE SPÉCIFIQUE (ID) ---
    // Ces phrases servent à détecter l'intention de recherche, le serveur extraira l'ID
    manager.addDocument('fr', 'info sur la commande', 'lookup.order');
    manager.addDocument('fr', 'statut commande', 'lookup.order');
    manager.addDocument('fr', 'combien de temps reste-t-il', 'lookup.order');
    
    manager.addDocument('fr', 'voir la page', 'lookup.page');
    manager.addDocument('fr', 'modifier la page', 'lookup.page');

    await manager.train();
    manager.save();
    console.log('🤖 Cerveau UAP mis à jour !');
}

module.exports = { manager, trainChatbot };
