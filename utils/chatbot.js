const { NlpManager } = require('node-nlp');

const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Entraînement du cerveau UAP Immo...');

    // --- 1. AIDE GÉNÉRALE ---
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis l\'assistant UAP Immo. Je peux vous aider à créer, gérer ou diffuser vos annonces.');

    manager.addDocument('fr', 'peux tu m\'aider', 'agent.help');
    manager.addDocument('fr', 'j\'ai besoin d\'aide', 'agent.help');
    manager.addDocument('fr', 'je suis perdu', 'agent.help');
    manager.addDocument('fr', 'comment ça marche', 'agent.help');
    manager.addAnswer('fr', 'agent.help', 'Bien sûr ! Je peux vous aider sur : la création d\'annonces, la modification de votre profil, les paiements ou le suivi de vos commandes. Dites-moi ce que vous cherchez.');

    // --- 2. COMPTE & SÉCURITÉ ---
    manager.addDocument('fr', 'changer mon mot de passe', 'account.password');
    manager.addDocument('fr', 'réinitialiser mot de passe', 'account.password');
    
    manager.addDocument('fr', 'changer mon adresse', 'account.address');
    manager.addDocument('fr', 'modifier ma facturation', 'account.address');

    manager.addDocument('fr', 'c\'est quoi la 2fa', 'account.2fa');
    manager.addDocument('fr', 'activer la double authentification', 'account.2fa');
    manager.addAnswer('fr', 'account.2fa', 'La 2FA sécurise votre compte. Vous pouvez l\'activer dans la section "Mon Profil".');

    // --- 3. GESTION DES ANNONCES ---
    manager.addDocument('fr', 'créer une annonce', 'property.create');
    manager.addDocument('fr', 'ajouter un bien', 'property.create');
    manager.addDocument('fr', 'nouvelle page', 'property.create');
    manager.addDocument('fr', 'comment créer une page', 'property.create');

    manager.addDocument('fr', 'modifier une annonce', 'property.edit');
    manager.addDocument('fr', 'changer le prix', 'property.edit');
    manager.addAnswer('fr', 'property.edit', 'Allez dans l\'onglet "Pages créées" et cliquez sur le bouton vert (crayon) à côté de la propriété.');

    // --- 4. STATISTIQUES (Nouveau) ---
    manager.addDocument('fr', 'a quoi sert le tableau statistics', 'stats.info');
    manager.addDocument('fr', 'c\'est quoi les statistiques', 'stats.info');
    manager.addDocument('fr', 'comprendre mes vues', 'stats.info');
    manager.addDocument('fr', 'voir les stats', 'stats.info');
    // Réponse gérée par le serveur pour ajouter un bouton d'action

    // --- 5. PAIEMENT & COMMANDES ---
    manager.addDocument('fr', 'télécharger ma facture', 'order.invoice');
    manager.addDocument('fr', 'suivi de commande', 'order.status');
    manager.addDocument('fr', 'c\'est quoi diffuser', 'payment.broadcast');
    
    manager.addDocument('fr', 'combien ça coûte', 'payment.price');
    manager.addDocument('fr', 'quel est le prix', 'payment.price');
    manager.addAnswer('fr', 'payment.price', 'Le pack de diffusion professionnelle coûte **500€** pour une durée de **90 jours**.');

    await manager.train();
    manager.save();
    console.log('🤖 Chatbot UAP : Entraînement terminé !');
}

module.exports = { manager, trainChatbot };
