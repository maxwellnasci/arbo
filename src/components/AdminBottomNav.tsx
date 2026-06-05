import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, LayoutGrid, Dumbbell, Mail } from 'lucide-react';
import styles from './AdminBottomNav.module.css';

export default function AdminBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/admin', icon: Home, label: 'Home', exact: true },
    { path: '/admin/alunos', icon: Users, label: 'Alunos' },
    { path: '/admin/turmas', icon: LayoutGrid, label: 'Turmas' },
    { path: '/admin/treinos', icon: Dumbbell, label: 'Treinos' },
    { path: '/admin/convites', icon: Mail, label: 'Convites' },
  ];

  return (
    <nav className={styles.container}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            className={styles.navItem}
            onClick={() => navigate(item.path)}
          >
            <Icon
              size={22}
              className={isActive ? styles.iconActive : styles.icon}
            />
            {isActive && <div className={styles.indicator} />}
          </button>
        );
      })}
    </nav>
  );
}
