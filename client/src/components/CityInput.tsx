import { useId } from 'react';
import { STORE_CITIES } from '../utils/chinaCities';

type CityInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

export default function CityInput({
  value,
  onChange,
  className = '',
  placeholder = '搜索城市',
}: CityInputProps) {
  const listId = useId();

  return (
    <>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        list={listId}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {STORE_CITIES.map(city => (
          <option key={`${city.province}-${city.name}`} value={city.name}>
            {city.province}
          </option>
        ))}
      </datalist>
    </>
  );
}
