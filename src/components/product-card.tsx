import Link from "next/link";

interface Product {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-xl border border-primary/10 bg-white transition-shadow hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h2 className="font-medium text-gray-900 group-hover:text-primary transition-colors">{product.title}</h2>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
          {product.description}
        </p>
        <p className="mt-2 text-lg font-semibold">
          {(product.price / 100).toFixed(2).replace(".", ",")} €
        </p>
      </div>
    </Link>
  );
}
