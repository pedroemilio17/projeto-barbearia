import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import Home from './pages/Home';

function App() {
  return (
    <ThemeProvider>
      <CartProvider>
        <Home />
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;
