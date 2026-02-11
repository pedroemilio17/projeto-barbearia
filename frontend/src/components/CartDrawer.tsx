import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { validateBookingForm, ValidationError } from '../utils/validation';
import { TIME_SLOTS } from '../data/services';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, getTotal, createOrder } =
    useCart();
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('cash');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateBookingForm(
      bookingDate,
      bookingTime,
      paymentMethod,
      notes
    );

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    setTimeout(() => {
      const order = createOrder({
        date: bookingDate,
        time: bookingTime,
        paymentMethod,
        notes: notes || undefined,
      });

      if (order) {
        setOrderCreated(true);
        setBookingDate('');
        setBookingTime('');
        setPaymentMethod('cash');
        setNotes('');

        setTimeout(() => {
          setOrderCreated(false);
          onClose();
        }, 3000);
      }

      setIsSubmitting(false);
    }, 800);
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const hasError = (field: string) => errors.some((err) => err.field === field);
  const getErrorMessage = (field: string) =>
    errors.find((err) => err.field === field)?.message;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={onClose}
      />

      <div className="relative ml-auto w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-lg flex flex-col overflow-hidden">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Carrinho
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {orderCreated ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-green-500 mb-4">
              <svg
                className="h-16 w-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Agendamento Confirmado!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Sua reserva foi criada com sucesso. Aguarde confirmação via WhatsApp.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Seu carrinho está vazio
              </p>
              <button
                onClick={onClose}
                className="text-gray-900 dark:text-gray-100 font-semibold hover:underline"
              >
                Continuar comprando
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.map((item) => (
                <div
                  key={item.serviceId}
                  className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.serviceName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        R$ {item.price.toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.serviceId)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.serviceId,
                          Math.max(1, item.quantity - 1)
                        )
                      }
                      className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center font-semibold text-gray-900 dark:text-gray-100">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.serviceId, item.quantity + 1)
                      }
                      className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <form onSubmit={handleBooking} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Data do Agendamento
                    </label>
                    <input
                      type="date"
                      min={getMinDate()}
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 ${
                        hasError('date')
                          ? 'border-red-500'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    />
                    {hasError('date') && (
                      <p className="text-red-500 text-xs mt-1">
                        {getErrorMessage('date')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Horário
                    </label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 ${
                        hasError('time')
                          ? 'border-red-500'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <option value="">Selecione um horário</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {hasError('time') && (
                      <p className="text-red-500 text-xs mt-1">
                        {getErrorMessage('time')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Método de Pagamento
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="payment"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={(e) =>
                            setPaymentMethod(e.target.value as 'cash')
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-gray-900 dark:text-gray-100">
                          Pagamento Presencial
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="payment"
                          value="online"
                          checked={paymentMethod === 'online'}
                          onChange={(e) =>
                            setPaymentMethod(e.target.value as 'online')
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-gray-900 dark:text-gray-100">
                          Pagamento Online
                        </span>
                      </label>
                    </div>
                    {hasError('paymentMethod') && (
                      <p className="text-red-500 text-xs mt-1">
                        {getErrorMessage('paymentMethod')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Observações (opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Algo específico que gostaria?"
                      maxLength={500}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {notes.length}/500 caracteres
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Processando...' : 'Confirmar Agendamento'}
                  </button>
                </form>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Total:
                </span>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  R$ {getTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
