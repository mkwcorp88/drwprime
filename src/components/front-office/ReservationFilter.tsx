'use client';

export default function ReservationFilter({
  filterStatus,
  filterDate,
  onStatusChange,
  onDateChange,
  onClearDate,
}: {
  filterStatus: string;
  filterDate: string;
  onStatusChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onClearDate: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-white/10">
      <select
        value={filterStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        className="fo-glass-input px-4 py-2 rounded-lg [&>option]:text-black"
      >
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <input
        type="date"
        value={filterDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="fo-glass-input px-4 py-2 rounded-lg [color-scheme:dark]"
      />

      {filterDate && (
        <button
          onClick={onClearDate}
          className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors"
        >
          Clear Date
        </button>
      )}
    </div>
  );
}
