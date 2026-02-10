import { User, ChatSession, Message } from '../types';
import { MOCK_MY_USER_ID } from '../constants';

const AVATAR_BASE = 'https://api.dicebear.com/7.x/avataaars/svg?seed=';

export const currentUser: User = {
  id: MOCK_MY_USER_ID,
  name: 'Frontend Master',
  avatar: `${AVATAR_BASE}FrontendMaster`,
  region: 'Shenzhen, China',
  signature: 'Coding creates the future.'
};

const names = [
  'File Transfer Assistant', 'Product R&D Group', 'Alice', 'Bob', 
  'Charlie', 'David', 'Eva', 'Frank', 'Grace', 'Helen'
];

export const generateContacts = (): User[] => {
  return names.map((name, index) => ({
    id: index === 0 ? 'file-helper' : index === 1 ? 'group-rd' : `user-${index}`,
    name: name,
    avatar: name === 'File Transfer Assistant' 
      ? 'https://cdn-icons-png.flaticon.com/512/3767/3767084.png' 
      : name === 'Product R&D Group'
      ? 'https://cdn-icons-png.flaticon.com/512/1256/1256650.png'
      : `${AVATAR_BASE}${name}`,
    region: index % 2 === 0 ? 'Beijing' : 'Shanghai',
    signature: `Status of ${name}...`
  }));
};

export const generateInitialSessions = (contacts: User[]): ChatSession[] => {
  // Create sessions for the first 5 contacts
  return contacts.slice(0, 5).map((contact, index) => {
    const isFileHelper = contact.id === 'file-helper';
    const isGroup = contact.id === 'group-rd';
    
    return {
      id: contact.id,
      userId: contact.id,
      unreadCount: index === 2 ? 3 : 0, // Mock unread for Alice
      isGroup: isGroup,
      messages: [
        {
          id: `msg-${contact.id}-1`,
          senderId: isFileHelper ? MOCK_MY_USER_ID : contact.id,
          type: 'text',
          content: isFileHelper 
            ? 'Desktop screenshot.png' 
            : isGroup 
            ? '@All Deployment successful.' 
            : 'Hey, are you free tonight?',
          timestamp: Date.now() - (index * 1000 * 60 * 60) // Staggered times
        }
      ]
    };
  });
};