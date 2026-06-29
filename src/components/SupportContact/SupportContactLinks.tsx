import { Mail, MessageCircle } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '../../constants/supportContact';

interface SupportContactLinksProps {
  layout?: 'row' | 'stack';
}

export function SupportContactLinks({ layout = 'row' }: SupportContactLinksProps) {
  const containerClass =
    layout === 'stack' ? 'space-y-4' : 'flex flex-wrap gap-6 text-sm';

  return (
    <div className={containerClass}>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Contact your company</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Mail className="w-4 h-4 shrink-0" />
          {SUPPORT_EMAIL}
        </a>
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reach out to support</p>
        <div className="space-y-1.5">
          {SUPPORT_WHATSAPP.map((contact) => (
            <a
              key={contact.region}
              href={contact.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>
                WhatsApp {contact.display}
                <span className="text-gray-500 dark:text-gray-400 font-normal">
                  {' '}
                  · {contact.region}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
