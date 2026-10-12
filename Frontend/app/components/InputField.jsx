export default function InputField({
  label,
  id,
  type = "text",
  required = false,
  value = "",
  onChange,
  autoComplete,
  placeholder,
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block px-2 text-sm font-medium leading-6"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        autoCapitalize={type === "text" ? "none" : undefined}
        placeholder={placeholder}
        className="block min-h-14 w-full rounded-[1.7rem] border-2 border-black/10 bg-white px-5 py-3 text-base text-gray-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] outline-none placeholder:text-gray-500 focus:ring-4 focus:ring-orange-300"
      />
    </div>
  );
}
