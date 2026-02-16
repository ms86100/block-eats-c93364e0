import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Settings, PlusCircle } from 'lucide-react';

export function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Link to="/seller/products">
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="text-primary" size={20} />
            </div>
            <div>
              <p className="font-medium text-xs">Manage Products</p>
              <p className="text-[10px] text-muted-foreground">Add or edit</p>
            </div>
          </CardContent>
        </Card>
      </Link>
      <Link to="/seller/settings">
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Settings className="text-secondary-foreground" size={20} />
            </div>
            <div>
              <p className="font-medium text-xs">Store Settings</p>
              <p className="text-[10px] text-muted-foreground">Payment & hours</p>
            </div>
          </CardContent>
        </Card>
      </Link>
      <Link to="/become-seller">
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-dashed">
          <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <PlusCircle className="text-accent" size={20} />
            </div>
            <div>
              <p className="font-medium text-xs">Add Business</p>
              <p className="text-[10px] text-muted-foreground">New store</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
