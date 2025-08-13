export const convertDateToUTC = (dateString: string) => {
  const date = new Date(dateString);

  const offsetMinutes = date.getTimezoneOffset();
  const absOffsetMinutes = Math.abs(offsetMinutes);

  const sign = offsetMinutes <= 0 ? "+" : "-";

  const hours = String(Math.floor(absOffsetMinutes / 60)).padStart(2, "0");
  const minutes = String(absOffsetMinutes % 60).padStart(2, "0");

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hoursLocal = String(date.getHours()).padStart(2, "0");
  const minutesLocal = String(date.getMinutes()).padStart(2, "0");
  const secondsLocal = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hoursLocal}:${minutesLocal}:${secondsLocal}${sign}${hours}:${minutes}`;
};
