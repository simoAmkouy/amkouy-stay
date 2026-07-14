/**
 * Mock content ported verbatim from "Amkouy Prototype.dc.html" (renderVals()).
 * Same French/Moroccan sample data as the design — not invented.
 */

// Properties, Owners, and Reservations are now backed by Supabase — see
// src/lib/queries/{properties,owners,reservations}.ts. Their mock types/arrays
// (Property/Owner/Reservation + get*ById helpers) have been removed from here.

export const dashboardSummary = {
  date: 'Lundi 29 juin 2026',
  userName: 'Youssef',
  revenueMonth: 'MAD 487 K',
  revenueGrowth: '+12,4%',
  profitMonth: 'MAD 198 K',
  profitGrowth: '+8,1%',
  occupancyPct: 87,
  occupied: 43,
  available: 7,
  arrivals: 9,
  departures: 6,
  cleaningDue: 8,
  maintenanceOpen: 4,
  paymentsDue: 3,
  contractsExpiring: 2,
  notificationCount: 5,
};

export const dashboardActivity = [
  { icon: 'login', bg: '#DEF7E6', color: '#15803D', text: 'Check-in · Nadia Cherkaoui', time: 'Il y a 12 min · Villa Anfa', amount: '+14 200', amtColor: '#15803D' },
  { icon: 'payments', bg: '#F8EFD4', color: '#8a6d1c', text: 'Versement propriétaire', time: 'Il y a 1 h · F. Zniber', amount: '−28 400', amtColor: '#EF4444' },
  { icon: 'cleaning_services', bg: '#E3F0FF', color: '#1E3A6E', text: 'Ménage terminé · Studio Agdal', time: 'Il y a 2 h · Rachida', amount: '', amtColor: '#15803D' },
  { icon: 'build', bg: '#FDEBEB', color: '#EF4444', text: 'Ticket ouvert · climatiseur', time: 'Il y a 3 h · App. Marina', amount: '', amtColor: '#EF4444' },
  { icon: 'event_available', bg: '#EEEAFB', color: '#6D4FC9', text: 'Nouvelle réservation · Booking', time: 'Il y a 4 h · Riad El Bahia', amount: '+11 800', amtColor: '#15803D' },
];

export const operationsUrgentAlert = "2 alertes urgentes\nFuite d'eau · Villa Anfa · Retard check-in · App. Gauthier";

export const operationsSections = [
  {
    title: 'Arrivées du jour', icon: 'login', color: '#22C55E', count: '9',
    items: [
      { time: '15h', title: 'Nadia Cherkaoui', sub: 'Villa Anfa · 2 nuits', tag: 'À préparer', tagBg: '#FDEBC8', tagColor: '#B45309' },
      { time: '16h', title: 'James Dawson', sub: 'Riad El Bahia · 5 nuits', tag: 'Prêt', tagBg: '#DEF7E6', tagColor: '#15803D' },
    ],
  },
  {
    title: 'Départs du jour', icon: 'logout', color: '#EF4444', count: '6',
    items: [
      { time: '11h', title: 'Lucas Martin', sub: 'App. Marina · check-out', tag: 'En cours', tagBg: '#E3E9F4', tagColor: '#1E3A6E' },
    ],
  },
  {
    title: 'Ménages', icon: 'cleaning_services', color: '#1E3A6E', count: '8',
    items: [
      { time: '12h', title: 'Villa Anfa', sub: 'Khadija · après départ', tag: 'Planifié', tagBg: '#E3E9F4', tagColor: '#1E3A6E' },
      { time: '13h', title: 'Studio Agdal', sub: 'Rachida · turnover', tag: 'En cours', tagBg: '#FDEBC8', tagColor: '#B45309' },
    ],
  },
  {
    title: 'Maintenance', icon: 'build', color: '#C9A84C', count: '4',
    items: [
      { time: '!', title: "Fuite d'eau — Villa Anfa", sub: 'Technicien Omar · urgent', tag: 'Urgent', tagBg: '#FAD9D9', tagColor: '#B91C1C' },
    ],
  },
];

export const financeSummary = { revenue: '487 K', expenses: '289 K', profit: '198 K', growth: '+12,4%' };

export const financeRevenueBars = [
  { m: 'Jan', h: '58%', color: '#E7D9AE' },
  { m: 'Fév', h: '66%', color: '#E7D9AE' },
  { m: 'Mar', h: '62%', color: '#E7D9AE' },
  { m: 'Avr', h: '78%', color: '#E7D9AE' },
  { m: 'Mai', h: '84%', color: '#E7D9AE' },
  { m: 'Juin', h: '100%', color: '#C9A84C' },
];

export const financeExpenses = [
  { label: 'Ménage & blanchisserie', amount: 'MAD 86 K', pct: '72%', color: '#1E3A6E' },
  { label: 'Maintenance', amount: 'MAD 64 K', pct: '54%', color: '#C9A84C' },
  { label: 'Commissions plateformes', amount: 'MAD 78 K', pct: '66%', color: '#6D4FC9' },
  { label: 'Charges & services', amount: 'MAD 61 K', pct: '51%', color: '#22C55E' },
];

export const financeOwnerPayments = [
  { initials: 'HB', name: 'Hassan Benali', date: 'Échéance 05 juil', amount: 'MAD 28 400', bg: '#FDEBC8', color: '#B45309', status: 'En attente' },
  { initials: 'FZ', name: 'Fatima Zniber', date: 'Versé 02 juil', amount: 'MAD 21 600', bg: '#DEF7E6', color: '#15803D', status: 'Versé' },
  { initials: 'MA', name: 'Mohamed Alami', date: 'En retard', amount: 'MAD 34 200', bg: '#FAD9D9', color: '#B91C1C', status: 'Retard' },
];

export type CleaningTask = {
  id: number;
  property: string;
  cleaner: string;
  due: string;
  status: 'En cours' | 'À faire' | 'Terminé' | 'Planifié';
  icon: string;
};

export const cleaningTasks: CleaningTask[] = [
  { id: 1, property: 'Villa Anfa', cleaner: 'Khadija B.', due: "Aujourd'hui 14h", status: 'En cours', icon: 'autorenew' },
  { id: 2, property: 'Studio Agdal', cleaner: 'Rachida M.', due: "Aujourd'hui 16h", status: 'À faire', icon: 'schedule' },
  { id: 3, property: 'App. Marina', cleaner: 'Khadija B.', due: 'Terminé 10h', status: 'Terminé', icon: 'check' },
  { id: 4, property: 'Riad El Bahia', cleaner: 'Aicha L.', due: 'Demain 11h', status: 'Planifié', icon: 'event' },
];

export function getCleaningTaskById(id: string | number) {
  return cleaningTasks.find((c) => String(c.id) === String(id)) ?? cleaningTasks[0];
}

export const cleaningChecklist = [
  { label: 'Chambres & literie', icon: 'check_circle', color: '#22C55E', textColor: '#1A1C1E' },
  { label: 'Salle de bain & sanitaires', icon: 'check_circle', color: '#22C55E', textColor: '#1A1C1E' },
  { label: 'Cuisine & vaisselle', icon: 'check_circle', color: '#22C55E', textColor: '#1A1C1E' },
  { label: 'Sols & poussières', icon: 'radio_button_unchecked', color: '#C9CDD6', textColor: '#8A8F98' },
  { label: 'Réapprovisionnement', icon: 'radio_button_unchecked', color: '#C9CDD6', textColor: '#8A8F98' },
];

export type MaintenanceTicket = {
  id: string;
  issue: string;
  property: string;
  tech: string;
  techInit: string;
  priority: 'Urgent' | 'Élevé' | 'Normal';
  status: 'Ouvert' | 'En cours' | 'Résolu';
};

export const maintenanceTickets: MaintenanceTicket[] = [
  { id: '1042', issue: "Fuite d'eau salle de bain", property: 'Villa Anfa', tech: 'Omar Fassi', techInit: 'OF', priority: 'Urgent', status: 'En cours' },
  { id: '1041', issue: 'Climatiseur défectueux', property: 'App. Marina', tech: 'Said Berrada', techInit: 'SB', priority: 'Élevé', status: 'Ouvert' },
  { id: '1039', issue: "Serrure porte d'entrée", property: 'Studio Agdal', tech: 'Omar Fassi', techInit: 'OF', priority: 'Normal', status: 'Ouvert' },
  { id: '1036', issue: 'Peinture salon', property: 'Riad El Bahia', tech: 'Hamid T.', techInit: 'HT', priority: 'Normal', status: 'Résolu' },
];

export function getMaintenanceTicketById(id: string) {
  return maintenanceTickets.find((m) => m.id === id) ?? maintenanceTickets[0];
}

export const maintenanceTimeline = [
  { dot: '#EF4444', ring: '#f7caca', label: 'Ticket signalé par le gardien', time: '27 juin · 08:14' },
  { dot: '#C9A84C', ring: '#f0e2b8', label: 'Technicien Omar assigné', time: '27 juin · 09:30' },
  { dot: '#1E3A6E', ring: '#cfdbf0', label: 'Diagnostic — joint à remplacer', time: '28 juin · 11:00' },
];

export const notifications = [
  { id: 1, icon: 'event_available', iconBg: '#DEF7E6', iconColor: '#15803D', title: 'Nouvelle réservation', body: 'Riad El Bahia · 22–27 juin · MAD 11 800', time: 'Il y a 20 min', unread: true },
  { id: 2, icon: 'build', iconBg: '#FDEBEB', iconColor: '#EF4444', title: 'Maintenance urgente', body: "Fuite d'eau signalée · Villa Anfa", time: 'Il y a 1 h', unread: true },
  { id: 3, icon: 'cleaning_services', iconBg: '#E3F0FF', iconColor: '#1E3A6E', title: 'Ménage à confirmer', body: 'Studio Agdal · turnover 16h', time: 'Il y a 2 h', unread: true },
  { id: 4, icon: 'payments', iconBg: '#F8EFD4', iconColor: '#8a6d1c', title: 'Paiement propriétaire dû', body: 'Hassan Benali · MAD 28 400 · 05 juil', time: 'Il y a 3 h', unread: true },
  { id: 5, icon: 'description', iconBg: '#EEEAFB', iconColor: '#6D4FC9', title: 'Contrat expire bientôt', body: 'Karim Bennis · expire le 31 juil', time: 'Hier', unread: true },
  { id: 6, icon: 'login', iconBg: '#DEF7E6', iconColor: '#15803D', title: 'Check-in effectué', body: 'Nadia Cherkaoui · Villa Anfa', time: 'Hier', unread: false },
];

export const ownerPortalSummary = { name: 'M. Hassan Benali', revenueMonth: '42 000', netPaid: '34 400', occupancyPct: '83%' };

export const ownerPortalReservations = [
  { property: 'Villa Anfa', dates: '12 – 18 juin · Nadia C.', amount: 'MAD 14 200' },
  { property: 'Villa Anfa', dates: '22 – 27 juin · James D.', amount: 'MAD 11 800' },
];

export const ownerPortalStatements = [
  { month: 'Juin 2026', amount: 'MAD 34 400' },
  { month: 'Mai 2026', amount: 'MAD 31 200' },
  { month: 'Avril 2026', amount: 'MAD 29 800' },
];

export const currentUser = { initials: 'YT', name: 'Youssef Tazi', role: 'Administrateur · Amkouy' };
