import { StatCardProps } from '@/types';

export const StatCard = ({
  title,
  value,
  icon,
  iconBgColor = 'bg-slate-800 text-slate-300',
  textColor = 'text-white',
}: StatCardProps) => {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-sm">
      <div>
        <p className="text-sm text-slate-400 font-medium">{title}</p>
        <h3 className={`text-3xl font-bold mt-1 ${textColor}`}>{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${iconBgColor}`}>{icon}</div>
    </div>
  );
};

export default StatCard;