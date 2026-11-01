import { useState } from 'react';
import Button from '../../components/Button/Button';
import plusIcon from '../../assets/icons/plus.svg';
import EmptyState from './components/EmptyState/EmptyState';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import styles from './HomePage.module.css';

// The product list does not exist yet, so the page always shows the first
// access state: it invites the user to add the first product.
function HomePage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // A new key remounts the drawer, so the form starts empty every time it
  // opens. The drawer is not remounted on close: the native dialog gives the
  // focus back to this button.
  const [drawerKey, setDrawerKey] = useState(0);

  const openDrawer = () => {
    setDrawerKey((key) => key + 1);
    setIsDrawerOpen(true);
  };

  return (
    <>
      <title>Careme</title>
      <h1 className={styles.pageTitle}>Your products</h1>
      <EmptyState
        title="Add your product"
        text="Start by adding your first product to manage your catalog"
        icon={
          <div className={styles.icon}>
            <img src={plusIcon} alt="" width={32} height={32} />
          </div>
        }
      >
        <div className={styles.action}>
          <Button label="Add product" onClick={openDrawer} />
        </div>
      </EmptyState>
      <AddProductDrawer
        key={drawerKey}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}

export default HomePage;
