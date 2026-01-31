import { useState } from "react";
import { usePortfolio, PORTFOLIO_ICONS, PORTFOLIO_COLORS } from "../context/PortfolioContext";
import { useLanguage } from "../context/LanguageContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import {
  Briefcase,
  PiggyBank,
  TrendingUp,
  Bitcoin,
  Home,
  GraduationCap,
  Car,
  Plane,
  Shield,
  Gift,
  Plus,
  ChevronDown,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";

// Icon component mapping
const IconMap = {
  "briefcase": Briefcase,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  "bitcoin": Bitcoin,
  "home": Home,
  "graduation-cap": GraduationCap,
  "car": Car,
  "plane": Plane,
  "shield": Shield,
  "gift": Gift,
};

export const PortfolioIcon = ({ icon, className = "w-4 h-4" }) => {
  const IconComponent = IconMap[icon] || Briefcase;
  return <IconComponent className={className} />;
};

export default function PortfolioSelector() {
  const { t } = useLanguage();
  const {
    portfolios,
    activePortfolio,
    selectPortfolio,
    selectAllPortfolios,
    addPortfolio,
    editPortfolio,
    removePortfolio,
    isAllSelected,
  } = usePortfolio();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#7c3aed",
    icon: "briefcase",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "#7c3aed",
      icon: "briefcase",
    });
    setEditingPortfolio(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (portfolio) => {
    setEditingPortfolio(portfolio);
    setFormData({
      name: portfolio.name,
      description: portfolio.description || "",
      color: portfolio.color,
      icon: portfolio.icon,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Portfolio name is required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingPortfolio) {
        await editPortfolio(editingPortfolio.id, formData);
        toast.success("Portfolio updated");
      } else {
        const newPortfolio = await addPortfolio(formData);
        selectPortfolio(newPortfolio);
        toast.success("Portfolio created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save portfolio");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (portfolio) => {
    if (portfolio.is_default) {
      toast.error("Cannot delete default portfolio");
      return;
    }

    try {
      await removePortfolio(portfolio.id);
      toast.success("Portfolio deleted");
    } catch (error) {
      toast.error("Failed to delete portfolio");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 min-w-[160px] justify-between"
            data-testid="portfolio-selector"
          >
            <div className="flex items-center gap-2">
              {isAllSelected ? (
                <>
                  <FolderOpen className="w-4 h-4" />
                  <span>All Portfolios</span>
                </>
              ) : (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activePortfolio?.color }}
                  />
                  <PortfolioIcon icon={activePortfolio?.icon} className="w-4 h-4" />
                  <span className="truncate max-w-[100px]">{activePortfolio?.name}</span>
                </>
              )}
            </div>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* All Portfolios Option */}
          <DropdownMenuItem
            onClick={selectAllPortfolios}
            className="cursor-pointer"
            data-testid="select-all-portfolios"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            <span>All Portfolios</span>
            {isAllSelected && <Check className="w-4 h-4 ml-auto text-primary" />}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />

          {/* Portfolio List */}
          {portfolios.map((portfolio) => (
            <div key={portfolio.id} className="flex items-center group">
              <DropdownMenuItem
                onClick={() => selectPortfolio(portfolio)}
                className="flex-1 cursor-pointer"
                data-testid={`portfolio-item-${portfolio.id}`}
              >
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: portfolio.color }}
                />
                <PortfolioIcon icon={portfolio.icon} className="w-4 h-4 mr-2" />
                <span className="truncate flex-1">{portfolio.name}</span>
                {activePortfolio?.id === portfolio.id && (
                  <Check className="w-4 h-4 ml-auto text-primary" />
                )}
              </DropdownMenuItem>
              
              {/* Edit/Delete Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenEdit(portfolio)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {!portfolio.is_default && (
                    <DropdownMenuItem
                      onClick={() => handleDelete(portfolio)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          <DropdownMenuSeparator />

          {/* Create New Portfolio */}
          <DropdownMenuItem
            onClick={handleOpenCreate}
            className="cursor-pointer"
            data-testid="create-portfolio-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Create Portfolio</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo">
              {editingPortfolio ? "Edit Portfolio" : "Create Portfolio"}
            </DialogTitle>
            <DialogDescription>
              {editingPortfolio
                ? "Update your portfolio details"
                : "Create a new portfolio to organize your investments"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Retirement, Growth, Tech Stocks"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-secondary/50"
                data-testid="portfolio-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Long-term investments"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-secondary/50"
                data-testid="portfolio-description-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PORTFOLIO_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.id })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      formData.color === color.id
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color.id }}
                    title={color.label}
                    data-testid={`color-${color.id}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {PORTFOLIO_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: icon.id })}
                    className={`w-10 h-10 rounded-md flex items-center justify-center transition-all ${
                      formData.icon === icon.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 hover:bg-secondary"
                    }`}
                    title={icon.label}
                    data-testid={`icon-${icon.id}`}
                  >
                    <PortfolioIcon icon={icon.id} className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} data-testid="save-portfolio-btn">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingPortfolio ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
