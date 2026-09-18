const Footer = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-400 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} TarabayMais. All rights reserved.</p>
        <p className="text-slate-500">Cultivating smarter farms and field service.</p>
      </div>
    </footer>
  );
};

export default Footer;
