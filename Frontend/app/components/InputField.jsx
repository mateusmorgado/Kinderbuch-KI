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
          className="mb-2 ml-2 inline-block rounded-full bg-black/55 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm"
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
