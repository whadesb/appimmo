const { NlpManager } = require('node-nlp');
const fs = require('fs');

const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Début de l\'entraînement du Chatbot...');

    // 1. SALUTATIONS
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addDocument('fr', 'hello', 'greetings.hello');
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis l\'assistant UAP.');

    // 2. COMMANDES
    manager.addDocument('fr', 'mes commandes', 'order.status');
    manager.addDocument('fr', 'voir mes commandes', 'order.status');
    manager.addDocument('fr', 'où sont mes achats', 'order.status');
    manager.addDocument('fr', 'statut commande', 'order.status');
    
    // 3. CRÉATION D'ANNONCE (On met le paquet ici !)
    manager.addDocument('fr', 'comment créer une annonce', 'property.create');
    manager.addDocument('fr', 'ajouter une propriété', 'property.create');
    manager.addDocument('fr', 'mettre en vente', 'property.create');
    manager.addDocument('fr', 'je veux vendre', 'property.create');
    manager.addDocument('fr', 'publier un bien', 'property.create');
    manager.addDocument('fr', 'créer une page', 'property.create');
    manager.addDocument('fr', 'nouvelle annonce', 'property.create');
    manager.addDocument('fr', 'je veux ajouter un bien', 'property.create'); // Phrase exacte
    manager.addDocument('fr', 'commencer une annonce', 'property.create');
    manager.addDocument('fr', 'faire une annonce', 'property.create');
    manager.addDocument('fr', 'vendre ma maison', 'property.create');
    manager.addDocument('fr', 'vendre mon appartement', 'property.create');

    // 4. AIDE (On réduit les phrases pour éviter la confusion)
    manager.addDocument('fr', 'aide', 'agent.help');
    manager.addDocument('fr', 'help', 'agent.help');
    manager.addDocument('fr', 'besoin d\'aide', 'agent.help');
    // manager.addDocument('fr', 'comment ça marche', 'agent.help'); // Retiré car "comment" créait la confusion

    manager.addAnswer('fr', 'agent.help', 'Je peux vous aider sur vos commandes ou la création d\'annonce.');

    await manager.train();
    manager.save();
    console.log('🚀 Chatbot entraîné et prêt !');
}

// SUPPRESSION DU CHARGEMENT AUTO POUR FORCER L'ENTRAÎNEMENT À CHAQUE DÉMARRAGE
// (Utile pendant le développement)
/* if (fs.existsSync('./model.nlp')) {
    manager.load();
} 
*/

module.exports = { manager, trainChatbot };
