import Logo from "@/app/components/Logo";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-100">
      <div className="w-20 h-8 flex items-center justify-center animate-pulse">
        <Logo className="w-full h-full text-primary fill-current" />
      </div>
    </div>
  );
}
