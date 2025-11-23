const { NlpManager } = require('node-nlp');

const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Entraînement du cerveau UAP Immo...');

    // --- 1. COMPTE & SÉCURITÉ ---
    // Mot de passe
    manager.addDocument('fr', 'changer mon mot de passe', 'account.password');
    manager.addDocument('fr', 'réinitialiser mot de passe', 'account.password');
    manager.addDocument('fr', 'j\'ai perdu mon mot de passe', 'account.password');
    manager.addDocument('fr', 'sécurité du compte', 'account.password');

    // Adresse / Facturation
    manager.addDocument('fr', 'changer mon adresse', 'account.address');
    manager.addDocument('fr', 'modifier ma facturation', 'account.address');
    manager.addDocument('fr', 'ajouter une adresse', 'account.address');
    manager.addDocument('fr', 'mes coordonnées', 'account.address');

    // 2FA
    manager.addDocument('fr', 'c\'est quoi la 2fa', 'account.2fa');
    manager.addDocument('fr', 'activer la double authentification', 'account.2fa');
    manager.addDocument('fr', 'sécuriser mon compte', 'account.2fa');
    manager.addAnswer('fr', 'account.2fa', 'La double authentification (2FA) sécurise votre compte via une application comme Google Authenticator. Vous pouvez l\'activer ou la désactiver dans la section "Mon Profil".');

    // --- 2. GESTION DES ANNONCES (LANDING PAGE) ---
    // Création
    manager.addDocument('fr', 'créer une annonce', 'property.create');
    manager.addDocument('fr', 'ajouter un bien', 'property.create');
    manager.addDocument('fr', 'nouvelle page', 'property.create');
    manager.addDocument('fr', 'comment faire une landing page', 'property.create');

    // Modification / Édition
    manager.addDocument('fr', 'modifier une annonce', 'property.edit');
    manager.addDocument('fr', 'changer le prix de mon bien', 'property.edit');
    manager.addDocument('fr', 'changer la description', 'property.edit');
    manager.addDocument('fr', 'mettre à jour les photos', 'property.edit');
    manager.addAnswer('fr', 'property.edit', 'Pour modifier une annonce, allez dans l\'onglet "Pages créées" et cliquez sur le bouton vert (crayon) à côté de la propriété concernée.');

    // Partage (URL / QR)
    manager.addDocument('fr', 'partager mon annonce', 'property.share');
    manager.addDocument('fr', 'ou est le qr code', 'property.share');
    manager.addDocument('fr', 'copier le lien', 'property.share');
    manager.addDocument('fr', 'comment envoyer mon annonce', 'property.share');
    manager.addAnswer('fr', 'property.share', 'Dans l\'onglet "Pages créées", vous avez des boutons pour : copier le lien (presse-papier) ou afficher le QR Code à scanner.');

    // --- 3. DIFFUSION & PAIEMENT ---
    // Diffusion / "Diffuser"
    manager.addDocument('fr', 'c\'est quoi diffuser', 'payment.broadcast');
    manager.addDocument('fr', 'comment publier mon annonce', 'payment.broadcast');
    manager.addDocument('fr', 'activer mon annonce', 'payment.broadcast');
    manager.addDocument('fr', 'bouton diffuser', 'payment.broadcast');
    manager.addAnswer('fr', 'payment.broadcast', 'Le bouton "Diffuser" (mégaphone) permet d\'activer votre annonce publiquement via notre pack professionnel. Il se trouve dans la liste de vos pages créées.');

    // Prix & Durée
    manager.addDocument('fr', 'combien ça coûte', 'payment.price');
    manager.addDocument('fr', 'quel est le prix', 'payment.price');
    manager.addDocument('fr', 'c\'est payant ?', 'payment.price');
    manager.addDocument('fr', 'durée de la diffusion', 'payment.price');
    manager.addAnswer('fr', 'payment.price', 'La création de page est gratuite. Le pack de diffusion professionnelle coûte **500€** et garantit une visibilité pendant **90 jours**.');

    // Méthodes de paiement
    manager.addDocument('fr', 'payer en bitcoin', 'payment.methods');
    manager.addDocument('fr', 'acceptez vous les cryptos', 'payment.methods');
    manager.addDocument('fr', 'payer par paypal', 'payment.methods');
    manager.addDocument('fr', 'moyens de paiement', 'payment.methods');
    manager.addAnswer('fr', 'payment.methods', 'Nous acceptons les paiements sécurisés via **PayPal** (Carte Bancaire) et **Bitcoin** (via BTCPay Server).');

    // --- 4. COMMANDES & FACTURES ---
    // Factures
    manager.addDocument('fr', 'télécharger ma facture', 'order.invoice');
    manager.addDocument('fr', 'ou sont mes factures', 'order.invoice');
    manager.addDocument('fr', 'j\'ai besoin d\'un reçu', 'order.invoice');
    
    // Statut Commande
    manager.addDocument('fr', 'suivi de commande', 'order.status');
    manager.addDocument('fr', 'est-ce que j\'ai payé', 'order.status');
    manager.addDocument('fr', 'mes commandes', 'order.status');

    // --- 5. DIVERS ---
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis l\'assistant UAP Immo. Je peux vous aider à créer, gérer ou diffuser vos annonces.');

    await manager.train();
    manager.save();
    console.log('🤖 Chatbot UAP : Entraînement terminé !');
}

module.exports = { manager, trainChatbot };
